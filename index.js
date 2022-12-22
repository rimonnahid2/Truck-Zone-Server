const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000

// MongoDB client
const uri = `mongodb+srv://${process.env.SECRET_USER}:${process.env.SECRET_PASSWORD}@cluster0.4fk7foe.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// middlewares
app.use(cors())
app.use(express.json())

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    const usersCollection = client.db('truckZone').collection('users');
    const brandsCollection = client.db('truckZone').collection('productBrands');
    const categoriesCollection = client.db('truckZone').collection('productCategories');
    const productsCollection = client.db('truckZone').collection('products');
    const blogsCollection = client.db('truckZone').collection('blogs');
    const bookingCollection = client.db('truckZone').collection('booking');
    const paymentsCollection = client.db('truckZone').collection('payments');

    const verifyAdmin = async (req, res, next) => {
      const decodedUID = req.decoded.uid;
      const query = { uid: decodedUID };
      const user = await usersCollection.findOne(query);
      console.log(decodedUID)
      if (user?.userType !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    // PRODUCT API
    app.get('/products', async (req, res) => {
      let query = { sellStatus: true };
      const products = await productsCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(products);
    })

    app.get('/advertise-products', async (req, res) => {
      let query = { adsStatus: "yes", sellStatus: true };
      const products = await productsCollection.find(query).limit(4).sort({ _id: -1 }).toArray();
      res.send(products);
    })

    app.post('/product', verifyJWT, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      let query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.send(product);

    })

    app.get('/category/:slug', async (req, res) => {
      const slug = req.params.slug;
      const categoryQuery = { slug: slug }
      const category = await categoriesCollection.findOne(categoryQuery);
      let query = { category: category.name };
      const products = await productsCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(products);
    })

    app.get('/brand/:slug', async (req, res) => {
      const slug = req.params.slug;
      const brandQuery = { slug: slug }
      const brand = await brandsCollection.findOne(brandQuery);
      let query = { brand: brand.name };
      const products = await productsCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(products);
    })

    app.put('/product/get-ads/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          adsStatus: 'yes'
        }
      }
      const result = await productsCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    app.put('/product/remove-ads/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          adsStatus: 'no'
        }
      }
      const result = await productsCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    app.delete('/product/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    })

    app.get('/my-products', verifyJWT, async (req, res) => {
      const uid = req.query.uid;
      const decodedUID = req.decoded.uid;
      if (uid !== decodedUID) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { sellerId: uid }
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    })

    app.get('/reported-products', async (req, res) => {
      const query = { reportStatus: true }
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    })

    app.put('/product/report-product/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          reportStatus: true
        }
      }
      const result = await productsCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    app.put('/product/remove-report/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          reportStatus: false
        }
      }
      const result = await productsCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    // USER API
    app.get('/users', async (req, res) => {
      let query = {};
      if (req.query.userType) {
        query = {
          userType: req.query.userType
        }
      }
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    })

    app.get('/user/:id', async (req, res) => {
      const id = req.params.id;
      let query = { uid: id };
      const user = await usersCollection.findOne(query);
      res.send(user);
    })

    app.post('/user', async (req, res) => {
      const email = req.body.email;
      const query = { email }
      const userCheck = await usersCollection.findOne(query);
      if (userCheck) {
        return res.send({ acknowledged: false })
      } else {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }

    })

    app.put('/user/make-admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          userType: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    app.put('/user/verify-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const udpateData = {
        $set: {
          verified: true
        }
      }
      const result = await usersCollection.updateOne(filter, udpateData, options)
      res.send(result)
    })

    app.delete('/user/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    })

    app.get('/brands', async (req, res) => {
      const query = {}
      const cursor = await brandsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/categories', async (req, res) => {
      const query = {}
      const cursor = await categoriesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    // Booking API
    app.get('/booking', verifyJWT, async (req, res) => {
      const uid = req.query.uid;
      const decodedUID = req.decoded.uid;
      if (uid !== decodedUID) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { userId: uid }
      const bookings = await bookingCollection.find(query).sort({ _id: -1 }).toArray();
      res.send(bookings);
    })

    app.post('/booking', verifyJWT, async (req, res) => {
      const booking = req.body;
      const query = {
        productId: booking.productId,
        userId: booking.userId
      }

      const alreadyBooked = await bookingCollection.find(query).toArray();

      if (alreadyBooked.length > 0) {
        const message = `Alread you have a booking, Check your booking chart!`
        return res.send({ acknowledged: false, message })
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })

    app.delete('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingCollection.deleteOne(filter);
      res.send(result);
    })

    app.get('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    })

    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.priceAmount;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = { _id: ObjectId(id) }
      const updatedDoc = {
        $set: {
          paymentStatus: true,
          transactionId: payment.transactionId
        }
      }
      const updatedResult = await bookingCollection.updateOne(filter, updatedDoc)

      const productId = payment.productId
      const productFilter = { _id: ObjectId(productId) }
      const updateProduct = {
        $set: {
          sellStatus: false,
        }
      }
      const productUpdated = await productsCollection.updateOne(productFilter, updateProduct)
      res.send(result, updatedResult, productUpdated);
    })


    // Blog API
    app.get('/blogs', async (req, res) => {
      let query = {};
      const blogs = await blogsCollection.find(query).toArray();
      res.send(blogs);
    })

    // JWT Token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1d' })
      res.send({ token })
    })

    app.get('/users/admin/:uid', async (req, res) => {
      const uid = req.params.uid;
      const query = { uid };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.userType === 'admin' });
    })

    app.get('/users/seller/:uid', async (req, res) => {
      const uid = req.params.uid;
      const query = { uid };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.userType === 'seller' });
    })

  }
  finally {

  }
}
run().catch(err => console.error(err))
app.get('/', (req, res) => {
  res.send('Car Dealer Zone Server Running...')
})



app.listen(port, () => {
  console.log(`Trak listening on port ${port}`)
})