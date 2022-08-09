import dotenv from 'dotenv';
import path from 'path';
dotenv.config({path : path.resolve(__dirname, '.env.config')});

const mongo_options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    socketTimeoutMS: 30000,
    keepAlive: true,
    retryWrites: true,
    minPoolSize: 10,
    maxPoolSize: 10
};

const mongo = {
    host : process.env.mongo_host,
    username : process.env.mongo_username,
    password : process.env.mongo_password,
    options : mongo_options,
    database : process.env.mongo_database,
    collections : {
        event : process.env.mongo_events,
        geocode : process.env.mongo_geocodes,
        past_events : process.env.mongo_past_events
    },
    // url : `mongodb+srv://${process.env.mongo_username}:${process.env.mongo_password}@cluster0.bftq6du.mongodb.net/${process.env.mongo_database}`
    // url : 'mongodb+srv://localhost/SocialButterfly'
    url: String(process.env.mongo_url)
};
console.log(mongo.url);

const server = {
    port : String(process.env.port),
    host : process.env.host,
    secret : process.env.secret,
    google_api_key : process.env.KEY,
    queue : String(process.env.EMAIL) || 'amqp://localhost'
};

const config = {
    server,
    mongo
};

export default config;