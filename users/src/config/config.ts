import dotenv from 'dotenv';
import path from 'path';
dotenv.config({path : path.resolve(__dirname, '.env.config')});

const SERVER_HOST = process.env.SERVER_HOST
const SERVER_PORT = process.env.SERVER_PORT || 1337;
const SERVER_TOKEN_EXPIRETIME = process.env.SERVER_TOKEN_EXPIRETIME || 3600;
const SERVER_TOKEN_ISSUER = process.env.SERVER_TOKEN_ISSUER || 'coolIssuer';
const SERVER_TOKEN_SECRET = process.env.SERVER_TOKEN_SECRET || 'superencryptedsecret';

const server = {
    hostname : SERVER_HOST,
    port : SERVER_PORT,
    token : {
        expireTime : SERVER_TOKEN_EXPIRETIME,
        issuer : SERVER_TOKEN_ISSUER,
        secret : SERVER_TOKEN_SECRET
    },
    queue : process.env.EMAIL 
};

const mongoOptions = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    socketTimeoutMS: 30000,
    keepAlive: true,
    retryWrites: true
};

const MONGO_USERNAME = process.env.MONGO_USERNAME;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const MONGO_HOST = process.env.MONGO_URL || `localhost`;
const MONGO_DATABASE = process.env.MONGO_DATABASE;
const MONGO_USERS = process.env.MONGO_USERS || 'Users';

const mongo = {
    host: MONGO_HOST,
    password: MONGO_PASSWORD,
    username: MONGO_USERNAME,
    options: mongoOptions,
    database : MONGO_DATABASE,
    collections : {
        MONGO_USERS,
        tokens : process.env.MONGO_JSON_WEB_TOKENS
    },

    url: `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.qavvp4s.mongodb.net/${MONGO_HOST}/${MONGO_DATABASE}`
};

const regex = {
    email : /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
    phone : /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    password : /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/
};

const config = {
    mongo : mongo,
    server : server,
    regex
}

export default config;