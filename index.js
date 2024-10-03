const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

//middleware
app.use(cors({
  //origin:['https://foodfun-5c49a.web.app','https://foodfun-5c49a.firebaseapp.com'],
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7xouwts.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.send({ message: 'not authorized' })
  }
  jwt.verify(token, process.env.ACCESSS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized' })
    }
    console.log(decoded)
    req.user = decoded
    next();
  })
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const foodCollection = client.db('foodFun').collection('foodCollection')
    const orderCollection = client.db('foodFun').collection('orderCollection')
    const TableBookingCollection = client.db('foodFun').collection('tableBooking')
    const userCollection = client.db('foodFun').collection('userCollection')

    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESSS_TOKEN_SECRET, { expiresIn: '1h' });
      res
        .cookie('token', token, {
          //httpOnly:false,
          httpOnly: true,
          //secure:true,
          secure: false,
          //sameSite:'none'


        })
        .send({ success: true })
    })
    //verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })

      }
      next()
    }

    app.post('/logout', async (req, res) => {
      const user = req.body
      console.log('logging out user', user)
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })
    //user creation
    app.post('/users', async (req, res) => {
      const user = req.body

      //checking user exist or not
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    //get admin 
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      console.log(email, admin)
      res.send({ admin })
    })

    //get request to get all foods
    app.get('/allfoods', async (req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)

      const cursor = foodCollection.find().skip(page * size).limit(size)
      const result = await cursor.toArray()
      res.send(result)
    })
    // get all orders api
app.get('/allOrders/:email', async(req,res)=>{
  const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      if(admin){
        const allOrders = await orderCollection.find().toArray()
        const ordersRev= allOrders.reverse()
        res.status(200).send(ordersRev)
      }else{
        res.status(400).send({message:'unathorized access'})
      }
})

    app.get('/myorders', verifyToken, async (req, res) => {
      const query = { email: req.query.email }
      if (req.query.email !== req.user.userEmail) {
        return res.status(403).send("forbidden")
      }

      const result = await orderCollection.find(query).toArray()

      res.send(result)
    })

    //my orders api
    app.get('/myorders', verifyToken, async (req, res) => {
      const query = { email: req.query.email }
      if (req.query.email !== req.user.userEmail) {
        return res.status(403).send("forbidden")
      }

      const result = await orderCollection.find(query).toArray()

      res.send(result)
    })
    //update status
    app.patch('/updateStatus/:id', async(req,res)=>{
      const id=req.params.id
      const updateData = req.body
      const query={_id: new ObjectId(id)}
      const result = await orderCollection.updateOne(query,{
        $set:updateData
      })
      res.send(result)

    })

    app.get('/myaddeditems', async (req, res) => {
      const query = { owner_email: req.query.email }
      // if(req.query.email!==req.user.userEmail){
      //   return res.status(403).send("forbidden")
      // }
      // console.log(req.cookies.token)
      // console.log("request for valid user",req.user)
      const result = await foodCollection.find(query).toArray()
      res.send(result)
    })



    //get a single food item
    app.get('/details/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await foodCollection.findOne(query)
      res.send(result)
    })
    //add an item api
    app.post('/additem', async (req, res) => {
      const item = req.body
      const result = await foodCollection.insertOne(item)
      res.send(result)

    })
    //post request to insert order collection
    app.post('/orders', async (req, res) => {
      const order = req.body
      itemId = order.itemId
      const orderQuantity = parseInt(order.order_quantity)
      const query = { _id: new ObjectId(itemId) }
      const food = await foodCollection.findOne(query)
      const prevOrderCount = food.order_count
      const newOrdercount = prevOrderCount + orderQuantity

      const filter = { _id: new ObjectId(itemId) }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          order_count: newOrdercount
        }
      };
      const result1 = await foodCollection.updateOne(filter, updateDoc, options)
      if (result1.modifiedCount === 1) {
        console.log("upadated")
      } else {
        console.log("not found")
      }

      const result = await orderCollection.insertOne(order)
      res.send({ result, result1 })
    })
    app.get('/myCart/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await orderCollection.find(query).toArray()
      res.send(result)
    })
    //update an item 
    app.post('/update/:id', async (req, res) => {

      const id = req.params.id
      const itemInfo = req.body
      const { foodName, price, category, desc, quantity, origin, photo_url } = itemInfo
      const update_quantity = parseInt(quantity)
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          item_name: foodName,
          img: photo_url,
          food_origin: origin,
          price: price,
          quantity: update_quantity,
          category: category,
          description: desc
        }
      };
      const result = await foodCollection.updateOne(filter, updateDoc, options)
      res.send(result)

    })

    //delete an order api
    app.delete('/deleteFromCart/:id', verifyToken, async (req, res) => {
      if (req.query.email !== req.user.userEmail) {
        return res.status(403).send("forbidden")
      }
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await orderCollection.deleteOne(query)
      res.send(result)

    })
    //delete an added Item of any user who added a food item
    app.delete('/deleteAddedItem/:id', async (req, res) => {
      const id = req.params.id
      const email = req.query.email
      const query = { _id: new ObjectId(id) }
      const result = await foodCollection.deleteOne(query)
      res.send(result)
    })

    //pagination api
    app.get('/foodcount', async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount()
      res.send({ count })
    })
    //table booking related api
    app.post('/bookTable', async (req, res) => {
      const bookingData = req.body
      const result = await TableBookingCollection.insertOne(bookingData)
      res.send(result)

    })
    app.get('/bookTable', async (req, res) => {
      const email = req.query.email
      const query = { email: email }
      const result = await TableBookingCollection.find(query).toArray()
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Food fun server is running')
})

app.listen(port, () => {
  console.log(`food fun server is running on ${port}`)
})
