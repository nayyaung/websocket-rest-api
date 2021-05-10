require('dotenv').config();
const logger = require('morgan');
const express = require('express');
const { nanoid } = require('nanoid');
const fs = require('fs');
const redis = require("redis");
const cors = require('cors'); 
const app = express();

app.use(cors());
const port = 3000;
var expressWs = require('express-ws')(app);

var publicKey = fs.readFileSync('./cert.pem');
var jwtoken = require('jsonwebtoken');
var jwt = require('express-jwt');
const redisClient = redis.createClient({
    user: process.env.REDIS_USER,
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
    no_ready_check: true,
    auth_pass: process.env.REDIS_PASSWORD, 
});

const { promisify } = require("util");
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);

redisClient.on("error", function (error) {
    console.error(error);
});

var middleware = {
    requireAuthentication: jwt({ secret: publicKey, algorithms: ['RS256'] }),
    adminVerifier: function (req, res, next) {
        const token = req.headers.authorization.replace("Bearer", "").trim();
        const decoded = jwtoken.verify(token, publicKey); 
        if (decoded["client-role"] != null && decoded["client-role"].includes("admin-role")) {
            next();
        } else {
            return res.status(403).json({ error: 'only admin role is allowed' });
        }
    }
}

const postKey = "pa_posts";
app.ws('/postsocket', async function (ws, req) {

    // const ticket = req.query.ticket; 
    // you can verify the ticket here. Ticket request from client should be authenticated by JWT token just like other two API.
 
    ws.on('message', async function (msg) {
        console.log('message received from client ' + msg);
        const payload = JSON.parse(msg);
        if (payload.add) {
            const post = {
                id: nanoid(),
                message: payload.message
            }
            let posts = await getAsync(postKey);
            if (posts == null || !posts || posts == "null") {
                posts = []; 
            } else {
                posts = JSON.parse(posts);
            }
            posts.push(post); 
            await setAsync(postKey, JSON.stringify(posts)); 
            
            var aWss = expressWs.getWss('/postsocket'); 
            aWss.clients.forEach(function (client) {  
                client.send(JSON.stringify({ mode: "add", post: post }));
            });
        } 
    });

    ws.on('close', () => {
        console.log('WebSocket was closed');
    })
});


app.get("/post", [middleware.requireAuthentication],
    async (req, res) => {
        let posts = await getAsync(postKey);
        if (posts == null || !posts || posts == "null") {
            posts = [];
        } else {
            posts = JSON.parse(posts);
        }
        res.json(posts);
    }
);

app.delete("/post/:id",
    [middleware.requireAuthentication, middleware.adminVerifier],
    async (req, res) => {
        const { id } = req.params;
        let posts = await getAsync(postKey); 
        if (posts == null || !posts || posts.toString() == "null") {
            posts = []; 
        } else {
            posts = JSON.parse(posts);
        }
        if (posts.find(p => p.id == id)) {
            posts = posts.filter(p => p.id != id);
            await setAsync(postKey, JSON.stringify(posts));
            var aWss = expressWs.getWss('/postsocket'); 
            aWss.clients.forEach(function (client) {  
                client.send(JSON.stringify({ mode: "remove", id: id }));
            }); 
        }
        res.sendStatus(200)
    });

app.use(logger("dev"));
app.get("/", (req, res) => res.send("websocket rest api"));
app.get("/health", (req, res) => res.json({ "status": "up" }));
app.listen(port, () =>
    console.log(`Post web socket app listening at http://localhost:${port}`)
);