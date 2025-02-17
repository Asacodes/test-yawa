const express = require('express')
const app = express()
const port = 4444
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

  docRef.doc(`another Test`).set({
    test: "test"
  })
  .then(() => {
      console.log('success')
  })
  .catch( (error) => {
      console.log(error)
  })

})



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})