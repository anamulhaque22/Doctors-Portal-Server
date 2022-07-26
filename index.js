const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPT_SECRET_KEY);
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@doctorsportalcluster.cymwy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization;
    console.log(authorization)
    if (!authorization) {
        return res.status(401).send({ message: "UnAuthorized Access in VerifyJWT" });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(401).send({ message: `Forbidden Access verifyJWT ${err}` });
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");
        const userCollection = client.db("doctors_portal").collection("users");
        const doctorCollection = client.db("doctors_portal").collection("doctors");
        const paymentCollection = client.db("doctors_portal").collection("payments");


        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const user = await userCollection.findOne({ email: decodedEmail });
            if (user.role === "admin") {
                next();
            } else {
                return res.status(401).send({ message: "Unauthorized Access" });
            }
        }

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);
        });

        //put user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token });
        })

        /* 
            API naming convention:
            app.get('/booking') //get all bookings in this collection or get more then one or by filer
            app.get('/booking:id') // get a specific booking by id
            app.post('/booking') // add a new booking
            app.patch('/booking/:id') // update existing booking data
            app.put('/booking/:id') // upsert ==> update if(exists) or insert if(!exists)
            app.delete('/booking/:id') // delete existing specific booking data
        */
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            //get all services
            const services = await serviceCollection.find({}).toArray();

            //get all bookings
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray();
            //for eatch service, fint bookings for that service
            services.forEach(service => {
                const serviceBooking = bookings.filter(booking => booking.name === service.name);
                const booked = serviceBooking.map(s => s.time);
                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available;
            })
            res.send(services)

        })

        //get a booking using id
        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })

        //post booking
        app.post('/booking', async (req, res) => {
            const bookingData = req.body;
            const query = { name: bookingData.name, date: bookingData.date, userName: bookingData.userName };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists });
            }
            const result = await bookingCollection.insertOne(bookingData);
            return res.send({ success: true, booking: result });
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const booking = await bookingCollection.find(query).toArray();
                return res.send(booking);
            } else {
                return res.status(403).send({ message: "Forbidden Access" });
            }
        })


        //get all user
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find({}).toArray();
            res.send(users);
        })

        //make user admin   
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            return res.send(result);

        })


        // get the user is admin or not
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const emailAccount = await userCollection.findOne({ email: email });
            const isAdmin = emailAccount.role === 'admin';
            res.send({ admin: isAdmin });
        })


        //get all doctors
        app.get('/doctor', async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors);
        })

        //post a new doctor
        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })

        //delete a doctor
        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await doctorCollection.deleteOne(query);
            res.send(result);
        })


        //payment API
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = parseInt(service.price);
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // 
        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
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

//require('crypto').randomBytes(64).toString('hex') //to genetate a random key string
