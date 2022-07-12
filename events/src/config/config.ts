import dotenv from 'dotenv';
import path from 'path';
dotenv.config({path : path.resolve(__dirname, '.env.config')});

const mongo_options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    socketTimeoutMS: 30000,
    keepAlive: true,
    retryWrites: true
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
    // url : `mongodb+srv://${process.env.mongo_username}:${process.env.mongo_password}@${process.env.mongo_host}`
    url : 'mongodb://localhost/SocialButterfly'
};

const server = {
    port : process.env.port,
    host : process.env.host,
    secret : process.env.secret,
    google_api_key : process.env.KEY
};

const config = {
    server,

    mongo
};

export default config;