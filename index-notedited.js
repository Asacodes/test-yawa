const express = require('express')
const app = express()
const port = 4444
const SteamUser = require('steam-user');
const bodyParser = require('body-parser')
const cors = require('cors');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
// const serviceAccount = require('./serviceAccountKey.json');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix newline characters
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const docRef = db.collection('steamLogins')

app.use(cors({
  origin: 'http://localhost:3000', // Allow only this domain
}));

app.use(bodyParser.json())


app.get('/', (req, res) => {
  res.send('Hello World!')

  // docRef.doc(`Itsworking`).set({
  //   test: "test"
  // })
  // .then(() => {
  //     console.log('success')
  // })
  // .catch( (error) => {
  //     console.log(error)
  // })

})

class SteamAuthManager {
  constructor() {
      this.users = new Map();
      this.pendingLogins = new Map();
  }

  createClient() {
      return new SteamUser({
          enablePicsCache: false,
          anonymousAccountType: 0
      });
  }

  login(username, password) {
      return new Promise((resolve, reject) => {
          // Check for existing login or pending login

          console.log('login diri')
          // console.log(this.users)
          // console.log(this.pendingLogins)
          console.log(username)

          if (this.users.has(username) || this.pendingLogins.has(username)) {
              return reject(new Error('User already logged in or in login process'));
          }

          const client = this.createClient();

          // Store pending login
          this.pendingLogins.set(username, client);
          // console.log(this.pendingLogins)

          client.on('steamGuard', (domain, callback) => {
              client.steamGuardCallback = callback;
              resolve({
                  needsGuard: true,
                  type: domain ? 'email' : 'mobile',
                  email: domain
              });
          });



          // client.on('webSession', function(sessionID, cookies) {
          //     const steamID64 = client.steamID.getSteamID64()
          //     console.log(steamID64)
          //     //dont forget session ID
          //     console.log(cookies)
          //     //cookie slice
          //     //s.slice(17)
          //     const data = {
          //         steamID64: steamID64,
          //         steamLoginSecure: cookies[0].slice(17),
          //         sessionID: sessionID
          //     }

          //      docRef.doc(`${steamID64}`).set(data)
          //         .then(() => {
          //             console.log('success')
          //         })
          //         .catch( (error) => {
          //             console.log(error)
          //         })

          //     // console.log(data)



          //     console.log(username, ' Got web session');
          //     // Do something with these cookies if you wish
          // });

          client.on('loggedOn', (details) => {
              if (details.anonymous) {
                  client.logOff();
                  this.pendingLogins.delete(username);
                  reject(new Error('Anonymous login not allowed'));
                  return;
              }

              // Remove from pending, add to active users
              this.pendingLogins.delete(username);
              this.users.set(username, client);
              resolve({ success: true });
          });

          client.on('error', (err) => {
              this.pendingLogins.delete(username);
              this.users.delete(username);
              reject(err);
          });

          client.logOn({
              accountName: username,
              password: password,
              anonymous: false
          });
      });
  }

  submitGuardCode(username, code) {
      return new Promise((resolve, reject) => {
          const client = this.pendingLogins.get(username);

          console.log('from submitGuardCode: '+client)

          if (!client) {
              reject(new Error('No pending authentication'));
              return;
          }

          client.on('loggedOn', (details) => {
              if (details.anonymous) {
                  client.logOff();
                  this.pendingLogins.delete(username);
                  reject(new Error('Anonymous login not allowed'));
                  return;
              }

              this.pendingLogins.delete(username);
              this.users.set(username, client);
              // resolve({ success: 'yawa' });
          });

          client.on('webSession', function(sessionID, cookies) {
            const steamID64 = client.steamID.getSteamID64()
            console.log(steamID64)
            //dont forget session ID
            console.log(cookies)
            //cookie slice
            //s.slice(17)
            const data = {
                steamID64: steamID64,
                steamLoginSecure: cookies[0].slice(17),
                sessionID: sessionID
            }

            //  docRef.doc(`${steamID64}`).set(data)
            //     .then(() => {
            //         console.log('success')
            //     })
            //     .catch( (error) => {
            //         console.log(error)
            //     })

            // console.log(data)

            // resolve({ success: 'cookiez' });
            resolve(data);

            console.log(username, ' Got web session');

            // Do something with these cookies if you wish
        });

          client.on('error', (err) => {
              this.pendingLogins.delete(username);
              this.users.delete(username);
              reject(err);
          });

          try {
              const callback = client.steamGuardCallback;
              if (callback) {
                  callback(code);
              } else {
                  reject(new Error('Invalid guard callback'));

                  //error bay need kaayo
              }
          } catch (err) {
              reject(err);
          }
      });
  }

  logout(username) {
      const client = this.users.get(username);
      if (client) {
          client.logOff();
          this.users.delete(username);
          return true;
      }
      return false;
  }
}

const steamAuthManager = new SteamAuthManager();

app.post('/steam/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      const result = await steamAuthManager.login(username, password);
      res.json(result);
  } catch (error) {
      res.status(400).json({ error: error.message });
  }
});

app.post('/steam/guard', async (req, res) => {
  const { username, code } = req.body;
  console.log(username, code)

  try {
      const result = await steamAuthManager.submitGuardCode(username, code);
      res.json(result);

  } catch (error) {
      res.status(400).json({ error: error.message });

  }
});

app.post('/steam/logout', (req, res) => {
  const { username } = req.body;

  const logoutResult = steamAuthManager.logout(username);
  res.json({ success: logoutResult });
});




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
