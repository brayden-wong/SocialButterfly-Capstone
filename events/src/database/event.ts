import { Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import config from '../config/config';
import axios from 'axios';
import Event from '../interfaces/event';
import Location from '../interfaces/location';
import range from '../interfaces/range';
import user from '../interfaces/user';
import amqp from 'amqplib';

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

const cityLocation = async(city: string) => {
    const location = await collections.geocode.findOne({ 'location.city' : city });
    if(location !== null)
        return location as Location;
    return null;
}

const nearMe = async(user: user) => {
    const results = await collections.event.find({
        location : {
                $near : {
                    $geometry : {
                        type : 'Point',
                        coordinates : user.base_location.coords
                    },
                    $maxDistance : 1000 * 1000
                }
            }
        }).toArray() as Event[];
    return results
}

const getEvents = async(query: Object[]): Promise<Event[]> => { return await collections.event.aggregate(query).toArray() as Event[]; };


const searchByTags = async(res: Response, city: string, radius : number, filters: string[]):Promise<Response> => { 
    const events: Event[] = [];
    const id = new Set();
    const location = await cityLocation(city);
    if(location)
        for(let i = 0; i < filters.length; i++) {
            const results = await collections.event.find({
                $and : [
                    { tags : filters[i] },
                    { location : {
                        $near : {
                            $geometry : {
                                type : 'Point',
                                coordinates : location.location.coordinates
                            },
                            $maxDistance : radius
                        }
                    }}
                ]
            }).project({ city : 0, location : 0, rsvp : 0 }).toArray() as Event[];

            results.forEach((item: Event) => {
                if(!id.has(item._id.toHexString())) {
                    events.push(item);
                    id.add(item._id.toHexString());
                }
            });

        }
    if(events.length === 0)
        return res.status(200).json('no events near you with these tags');
    return res.status(200).json(events);
};

const rsvp = async(res: Response, id: ObjectId, user : user): Promise<Response> => {
    if((await collections.event.find({ $and : [ { _id : id }, { rsvp : user.email }]}).toArray()).length > 0) 
        return res.status(500).json('user has already rsvp to the event');
    else {
        const event = await collections.event.findOne({_id : id}) as Event;
        if(event.available_slots == 0)
            return res.status(500).json('no more available slots')
        else if(event.available_slots == -1)
            event.rsvp.push(user.email);
        else {
            event.rsvp.push(user.email);
        event.available_slots--;
        }

        await collections.event.replaceOne({ _id : id }, event);

        const send = async() => {
            const url = config.server.queue || 'amqp://localhost';
                const connection = await amqp.connect(url);
                const channel = await connection.createChannel();
                await channel.assertQueue('register account', {durable : true});
            
                let options = {
                    from : '',
                    to : user.email,
                    subject : 'Social Butterfly Account Activation',
                    html : 'Hello, <br> Thank you for rsvp\'ing for the event!<br>'
                    + 'You will receive a reminder email 1 week before the event.<br><br>'
                    + '©SocialButterfly'
                };
    
                channel.sendToQueue('rsvp', Buffer.from(JSON.stringify(options)));
        }
        await send();

        return res.status(200).json('user has been added to the email rsvp list');
    }
}

const validateLocation = async(user: user): Promise<user> => {
    const result = await collections.geocode.findOne({ 'location.city' : user.base_location.city }) as Location;

    if(result !== null) {
        user.base_location.coords = result.location.coordinates;
        return user;
    } else {
        await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address : user.base_location.city,
                key : config.server.google_api_key
            }
        })
            .then(async response => {
                const location: Location = {
                    _id : new ObjectId(),
                    location : {
                        type: 'Point',
                        city : response.data.results[0].address_components.filter((address : { types : string | string[];}) => address.types.includes('locality'))[0].long_name,
                        coordinates : [
                            response.data.results[0].geometry.location.lng,
                            response.data.results[0].geometry.location.lat
                        ]
                    }
                };

                user.base_location.city = location.location.city;
                user.base_location.coords = location.location.coordinates;
                await insertCity(location);
                return user;
            });
        return user;
    }
}

export default { checkLocation, insertEvent, insertCity, validateLocation, eventsThisMonth, doTagsMatch, getEvents, searchByTags, rsvp, cityLocation, nearMe };