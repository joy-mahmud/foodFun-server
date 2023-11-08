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
//   origin:['http://localhost:5173'],
//   credentials:true
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


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const foodCollection = client.db('foodFun').collection('foodCollection')
    const orderCollection = client.db('foodFun').collection('orderCollection')
   
    app.post('/jwt', async(req,res)=>{
      const user = req.body
      const token = jwt.sign(user,process.env.ACCESSS_TOKEN_SECRET, { expiresIn: '1h' }); 
      res
      .send({success:true})
    })

    //get request to get all foods
    app.get('/allfoods', async(req,res)=>{
        const cursor = foodCollection.find()
        const result = await cursor.toArray()
        res.send(result)
    })

    //my orders api
    app.get('/myorders',async(req,res)=>{
        const query = {email:req.query.email}
        // if(req.query.email!==req.user.userEmail){
        //   return res.status(403).send("forbidden")
        // }
        // console.log(req.cookies.token)
        // console.log("request for valid user",req.user)
        const result = await orderCollection.find(query).toArray()
       
        res.send(result)
    })
    app.get('/myaddeditems',async(req,res)=>{
        const query = {owner_email:req.query.email}
        // if(req.query.email!==req.user.userEmail){
        //   return res.status(403).send("forbidden")
        // }
        // console.log(req.cookies.token)
        // console.log("request for valid user",req.user)
        const result = await foodCollection.find(query).toArray()
        res.send(result)
    })

    

    //get a single food item
    app.get('/details/:id', async(req,res)=>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result =  await foodCollection.findOne(query)
        res.send(result)
    })
    //add an item api
    app.post('/additem',async(req,res)=>{
        const item = req.body
        const result = await foodCollection.insertOne(item)
        res.send(result)

    })
    //post request to insert order collection
    app.post('/orders', async(req,res)=>{
        const order = req.body
        itemId = order.itemId
        const orderQuantity = parseInt(order.order_quantity)
        const query = {_id: new ObjectId(itemId)}
        const food = await foodCollection.findOne(query)
        const prevOrderCount = food.order_count
        const newOrdercount = prevOrderCount + orderQuantity
        
        const filter = {_id: new ObjectId(itemId)}
        const options = {upsert: true }
        const updateDoc = {
            $set: {
              order_count:newOrdercount
            }
          };
          const result1 = await foodCollection.updateOne(filter, updateDoc, options)
          if(result1.modifiedCount === 1){
            console.log("upadated")
          }else{
            console.log("not found")
          }
        
         const result = await orderCollection.insertOne(order)
         res.send({result,result1})
    })
    //update an item 
    app.post('/update/:id', async(req,res)=>{
        const id = req.params.id
        const itemInfo = req.body
        const {foodName,price,category,desc,quantity,origin,photo_url} =itemInfo
        const update_quantity = parseInt(quantity)
        const filter = {_id: new ObjectId(id)}
        const options = {upsert: true }
        const updateDoc = {
            $set: {
                item_name:foodName,
                img:photo_url,
                food_origin:origin,
                price:price,
                quantity:update_quantity,
                category:category,
                description:desc
            }
          };
          const result = await foodCollection.updateOne(filter, updateDoc, options)
          res.send(result)

    })

    //delete an order api
    app.delete('/delete/:id', async(req,res)=>{
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const result = await orderCollection.deleteOne(query)
        res.send(result)
        
    })

   
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Food fun server is running')
})

app.listen(port,()=>{
    console.log(`food fun server is running on ${port}`)
})
