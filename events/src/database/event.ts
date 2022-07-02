import { MongoClient, ObjectId } from 'mongodb';
import config from '../config/config';


const client = new MongoClient(config.mongo.url, config.mongo.options);
client.connect();

const db = client.db(config.mongo.database);
const collections = {
    event : db.collection(String(config.mongo.collections.event)),
    geocode : db.collection(String(config.mongo.collections.geocode)),
    past_event : db.collection(String(config.mongo.collections.past_events))
};

// const sphereIndex = async() => {
//     const result = await collections.geocode.find({
//     location : {
//             $near : {
//                 $geometry : {
//                     type : 'point',
//                     coordinates : [-111.8761762, 40.7618173]
//                 },
//                 $maxDistance : 1000,
//                 $minDistance : 1
//             }
//         }
//     }).toArray();
    
//     console.log(`these are the results: ${result}`);
// }

//sphereIndex();

const checkLocation = async(city : string): Promise<boolean> => {
    const result = await collections.geocode.find({ city : city }).toArray();
    console.log(result.length);
    if(result.length > 0)
        return true;
    return false;
}

export default { checkLocation };