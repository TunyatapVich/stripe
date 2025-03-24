const cors = require("cors");
const express = require("express");
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',  // Change if using Docker
  user: 'myuser',       // Your MySQL username
  password: 'mypassword', // Your MySQL password
  database: 'mydatabase', // Your database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = 8000;

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = "whsec_674e4728fb7a9570650bb3c28dd6dc8312c2844842c59dac2e1ec6668c6b46b5"; // เอาได้จากเว็บของ Stripe

// Middlewares here
app.use(cors());

let conn = null;

const initMySQL = async () => {
  conn = await mysql.createConnection({
    host: "localhost",
    user: "myuser",
    password: "mypassword",
    database: "mydatabase",
  });
};

/* code ที่เขียนด้านล่างนี้จะเป็นการเพิ่มเติมส่วนจากตรงนี้ */

app.get("/test",  (req, res) => {
    console.log("Test API");
    res.json({ message: "Hello World" });
    });

app.post('/api/checkout', express.json(), async (req, res) => {
    const { user , product } = req.body;
    try {
        const orderId = uuidv4();
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'thb',
                        product_data: {
                            name: product.name,
                        },
                        unit_amount: product.price * 100,
                    },
                    quantity: product.quantity,
                },
            ],
            mode: 'payment',
            success_url: `http://localhost:8888/success.html?id=${orderId}`,
            cancel_url: `http://localhost:8888/cancel.html?id=${orderId}`,
        });
    
        const orderData = {
            fullname: user.name,
            address: user.address,
            order_id: orderId,
            session_id: session.id,
            status: session.status
        }

        console.log ("session", session);

        const [result] = await conn.query("INSERT INTO orders SET ?", orderData);

        res.json({
            user,
            product,
            sessionId: session.id,
            });
    } catch (error) {
        console.error("Error", error);
        res.status(400).json({ message: error.message });
    }
    });


    app.get('/api/order/:id', async (req, res) => {
        const orderId = req.params.id;
        try {
            const [result] = await conn.query("SELECT * FROM orders where order_id = ?", orderId);
            const orderResult = result[0];
            res.json({
                order: orderResult
                });
            

        } catch (error) {
            console.error("Error", error);
            res.status(400).json({ message: error.message });
        }
    });

    app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
        const sig = req.headers["stripe-signature"];
      
        let event;
      
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
          res.status(400).send(`Webhook Error: ${err.message}`);
          return;
        }
      
        // Handle the event
        switch (event.type) {
          case "checkout.session.completed":
            const paymentData = event.data.object;
            console.log("Paymentdata!", paymentData);

            const sessionId = paymentData.id;
 
            const data = {
                status: paymentData.payment_status
            };

            const [result] = await conn.query("UPDATE orders SET ? WHERE session_id = ?", 
                [data , sessionId]
            )

            console.log("updated result", result);

            break;
          default:
            console.log(`Unhandled event type ${event.type}`);
        }
      
        // Return a 200 response to acknowledge receipt of the event
        res.send();
      });



// Listen
app.listen(port, async () => {
  await initMySQL();
  console.log("Server started at port 8000");
});