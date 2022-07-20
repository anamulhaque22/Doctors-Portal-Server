const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
// app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@doctorsportalcluster.cymwy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        app.get('/service',async(req, res) => {
            const query = {};
            const cursor= serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);
console.log("urk",uri)
app.get('/', (req, res) => {
    res.send('Hello World');
})

app.listen(port, () => {
    console.log(`Doctors app is running on port ${port}`);
})