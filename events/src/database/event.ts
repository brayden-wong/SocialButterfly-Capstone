import { MongoClient, ObjectId } from 'mongodb';
import config from '../config/config';
import Event from '../interfaces/event';
import Location from '../interfaces/location';
import range from '../interfaces/range';

const client = new MongoClient(config.mongo.url, config.mongo.options);
client.connect();

const db = client.db(config.mongo.database);
const collections = {
    event : db.collection(String(config.mongo.collections.event)),
    geocode : db.collection(String(config.mongo.collections.geocode)),
    past_event : db.collection(String(config.mongo.collections.past_events))
};

const eventsThisMonth = async(date: range): Promise<Event[]> => {
    return await collections.event.find({ date : date }).toArray() as Event[];
}

const sphereIndex = async() => {
    const result = await collections.event.find({
    location : {
            $near : {
                $geometry : {
                    type : 'Point',
                    coordinates : [-111.8761762, 40.7618173]
                },
                $maxDistance : 1000 * 1000
            }
        }
    }).toArray() as Event[];
    //console.log(`these are the results: ${result}`);
}

//sphereIndex();

const insertCity = async(location: Location) => {
    await collections.geocode.insertOne(location);
}

const insertEvent = async(event : Event) => {
    await collections.event.insertOne(event);
};

const checkLocation = async(city : string): Promise<boolean> => {
    const result = await collections.geocode.find({ 'location.city' : city }).toArray();
    if(result !== null)
        if(result.length > 0)
            return true;
    return false; 
}

const doTagsMatch = async(event: Event): Promise<Boolean> => {
    console.log(event);
    const results = await collections.event.find({ 
        location : {
            $near : {
                $geometry : {
                    type : 'Point',
                    coordinates : [ event.location.coordinates[0], event.location.coordinates[1] ]
                },
                $maxDistance : 40233.6
            }
        },
        tags : event.tags 
    }).toArray() as Event[]

    if(results.length > 0)
        return true;
    return false;
}

const getEvents = async(query: Object[]): Promise<Event[]> => {
const result = await collections.event.aggregate(query).toArray() as Event[];
    console.log('results', result)
    return await collections.event.aggregate(query).toArray() as Event[];
}


export default { checkLocation, insertEvent, insertCity, eventsThisMonth, doTagsMatch, getEvents };