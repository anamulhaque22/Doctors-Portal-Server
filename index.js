const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@doctorsportalcluster.cymwy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        /* 
            API naming convention:
            app.get('/booking') //get all bookings in this collection or get more then one or by filer
            app.get('/booking:id') // get a specific booking by id
            app.post('/booking') // add a new booking
            app.patch('/booking/:id') // update existing booking data
            app.delete('/booking/:id') // delete existing specific booking data
        */

        //post booking
        app.post('/booking', async (req, res) => {
            const bookingData = req.body;
            const query = {name: bookingData.name, date: bookingData.date, userName: bookingData.userName};
            const exists = await bookingCollection.findOne(query);
            if(exists){
                return res.send({success:false, booking:exists});
            }
            const result = await bookingCollection.insertOne(bookingData);
            return res.send({success:true, booking:result});
        })




    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello, From Doctors Portal');
})

app.listen(port, () => {
    console.log(`Doctors app is running on port ${port}`);
})