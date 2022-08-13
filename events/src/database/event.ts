import { Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import config from '../config/config';
import Event from '../interfaces/event';
import Location from '../interfaces/location';
import range from '../interfaces/range';
import user from '../interfaces/user';
import amqp from 'amqplib';
import { request } from '../request.helper';

const client = new MongoClient(config.mongo.url, config.mongo.options);
client.connect();

const db = client.db(config.mongo.database);
const collections = {
    event : db.collection(String(config.mongo.collections.event)),
    geocode : db.collection(String(config.mongo.collections.geocode)),
    past_event : db.collection(String(config.mongo.collections.past_events))
};
let looper = true;

const checkTime = setInterval(async () => { 
    console.log(looper);
    let date = new Date();
    if(date.getHours() === 18 && looper) {
        sendRSVP(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7));
        looper = false;
    }
    if(date.getHours() === 24)
        looper = true;
}, 60000);

// indexed query for searching for cities that are not case sensitive
//{ $text : { $search : "SalT lake CiTY", $caseSensitive: false }}
collections.event.createIndex({ location : '2dsphere' });
collections.event.createIndex({ online: 1 });
collections.geocode.createIndex({ location : '2dsphere'});

const eventsToday = async(date: Date) => {
    let results: Event[];
    const after = String(date.getFullYear()) + '-' + String((date.getMonth() + 1)) + '-' + String(date.getDate() + 1);
    if(date.getTime() % 15 === 0) {
        results = await collections.event.find({
            date : {$lt : new Date(after)}
        }).toArray() as Event[];

        for(let i = 0; i < results.length; i++) {
            await collections.event.deleteOne(results[i]);
            await collections.past_event.insertOne(results[i]);
        }
    }
}

setTimeout(() => {
    eventsToday(new Date());
}, 60000);

const sendRSVP = async (date : Date) => {
    const temp = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    const events = await collections.event.find({
        $and : [
            { date : { $gte : date }},
            { date : { $lt : temp }}]}).project({ 
                event_name : 1,
                date : 1, time : 1,
                rsvp : 1 
    }).toArray() as Event[];

    const send = async(events: Event[]) => {
        const url = config.server.queue || 'amqp://localhost';
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue('rsvp', {durable : true});

        const emails: string[] = [];
        events.forEach( event => {
        event.rsvp.forEach(email => {
                emails.push(email);
            });
        });

        for(let i = 0; i < events.length; i++) {
            for(let k = 0; k < events[i].rsvp.length; k++) {
                const response = await request('http://gateway:8080/users/user-by-email', 'get', undefined, { email : events[i].rsvp[k]})
                if(response === null)
                    break;
                const user = response.data as user;

                let options = {
                    from : '',
                    to : events[i].rsvp[k],
                    subject : 'Social Butterfly RSVP Notification',
                    html : `Hello ${user.name}, <br> Thank you for signing up early for the event!  Just a reminder, the event you signed up for is here in 1 week<br>`
                    + `Event: ${events[i].event_name}<br>Date: ${events[i].date.toDateString()}<br>Time: ${events[i].time}`
                    + '<br><br>'
                    + '©SocialButterfly'
                };
                channel.sendToQueue('event reminder', Buffer.from(JSON.stringify(options)));
            }    
        }   
    }

    if(events !== null)
        await send(events);
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
    const location = await collections.geocode.findOne({ 'location.city' : new RegExp(city, 'i')});
    if(location !== null)
        return location as Location;
    return null;
}

const nearMe = async(user: user) => {
    const results = await collections.event.find({
        $and : [
            { $or : [
                { available_slots : { $gt : 0}},
                { available_slots : { $eq : -1}}
            ],
            location : {
                $near : {
                    $geometry : {
                        type : 'Point',
                        coordinates : user.base_location.coords
                    },
                    $maxDistance : user.base_location.distance
                }
            }}
        ]
    }).sort({ date : 1 }).toArray() as Event[];
    return results
}

const getEvents = async(aggregate: Object[] | undefined, index: {} | undefined): Promise<Event[]> => { 
    if(index !== undefined) {
        console.log('find');
        return await collections.event.find(index).project({ location : 0, city : 0, rsvp : 0, dist : 0}).toArray() as Event[];
    }
    if(aggregate !== undefined) {
        console.log('aggregate');
        return await collections.event.aggregate(aggregate).project({ location : 0, city : 0, rsvp : 0, dist : 0}).toArray() as Event[];
    }
    return [];
};

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
    if((await collections.event.find({ $and : [ { _id : id }, { rsvp : { $in : [user.email] }}]}).toArray()).length > 0) 
        return res.status(500).json('user has already rsvp to the event');
    else {
        const event = await collections.event.findOne({_id : id}) as Event;
        if(event.available_slots == 0)
            return res.status(500).json('no more available slots')
        if(event.available_slots !== -1)
            event.available_slots--; 
        event.rsvp.push(user.email);

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
    const city = user.base_location.city.split(',')[0];
    const result = await collections.geocode.findOne({ 'location.city' : new RegExp(city, 'i') }) as Location;
    if(result !== null) {
        user.base_location.coords = result.location.coordinates;
        return user;
    } 
    const response = await request('https://maps.googleapis.com/maps/api/geocode/json', 'get',
    { address : user.base_location.city, key : config.server.google_api_key });

    if(response === null)
        return user;
    const location: Location = {
        _id : new ObjectId(),
        location : {
            type: 'Point',
            city : response.data.results[0].address_components[0].long_name,
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
}

const updateEvent = async(res: Response, email : string, old : string): Promise<Response> => {
    await collections.event.updateMany(
        {rsvp : { $in : [old] }},
        {$set : { 'rsvp.$' : email }});
    return res.status(200).json('updated');
}

const getLocations = async() => {return await collections.geocode.find().toArray() as Location[];}

const insertManyEvents = (events: Event[]) => {collections.event.insertMany(events);}

const oneEvent = async(id: string) => {
    return await collections.event.findOne({ _id : new ObjectId(id) }) as Event;
}

export default { oneEvent, updateEvent, insertManyEvents, getLocations, checkLocation, insertEvent, insertCity, validateLocation, eventsThisMonth, doTagsMatch, getEvents, sendRSVP, searchByTags, rsvp, cityLocation, nearMe };