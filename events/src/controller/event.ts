import { Response, Request } from 'express';
import { ObjectId } from 'mongodb';
import Event from '../interfaces/event';
import axios from 'axios';
import Location from '../interfaces/location';
import config from '../config/config';
import database from '../database/event';
import range from '../interfaces/range';
import query from '../interfaces/query';
import user from '../interfaces/user';
import verify from '../middleware/verify';
import event from '../database/event';


const getMonth = async(date: Date) => {
    const month = date.getMonth() + 1;

    const isLeapYear = (year: number) => {
        return year % 100 === 0 ? year % 400 === 0 : year % 4 === 0;
    }

    const query = (month: number): range => {
        switch(month) {
            case 1: 
                return { '$gte' : new Date('01-01-' + date.getFullYear()), '$lte' : new Date('02-01-' + date.getFullYear())};
            case 2:
                if(isLeapYear(date.getFullYear())) {
                    return { '$gte' : new Date('02-01-' + date.getFullYear()), '$lte' : new Date('03-01-' + date.getFullYear())};
                } else {
                    return { '$gte' : new Date('02-01-' + date.getFullYear()), '$lte' : new Date('03-01-' + date.getFullYear())};
                } 
            case 3:
                return { '$gte' : new Date('03-01-' + date.getFullYear()), '$lte' : new Date('04-01-' + date.getFullYear())};
            case 4:
                return { '$gte' : new Date('04-01-' + date.getFullYear()), '$lte' : new Date('05-01-' + date.getFullYear())};
            case 5:
                return { '$gte' : new Date('05-01-' + date.getFullYear()), '$lte' : new Date('06-01-' + date.getFullYear())};
            case 6:
                return { '$gte' : new Date('06-01-' + date.getFullYear()), '$lte' : new Date('07-01-' + date.getFullYear())};
            case 7:
                return { '$gte' : new Date('07-01-' + date.getFullYear()), '$lte' : new Date('08-01-' + date.getFullYear())};
            case 8:
                return { '$gte' : new Date('08-01-' + date.getFullYear()), '$lte' : new Date('09-01-' + date.getFullYear())};
            case 9:
                return { '$gte' : new Date('09-01-' + date.getFullYear()), '$lte' : new Date('10-01-' + date.getFullYear())};
            case 10:
                return { '$gte' : new Date('10-01-' + date.getFullYear()), '$lte' : new Date('11-01-' + date.getFullYear())};
            case 11:
                return { '$gte' : new Date('11-01-' + date.getFullYear()), '$lte' : new Date('12-01-' + date.getFullYear())};
            case 12:   
                return { '$gte' : new Date('12-01-' + date.getFullYear()), '$lte' : new Date('01-01-' + date.getFullYear() + 1)};
            default:
                return {'$gte' : null, '$lte' : null }
        }
    }
    return await database.eventsThisMonth(query(month));
}

const validateEvent = async(event: Event): Promise<Boolean> => {
    const results = await getMonth(event.date);

    if(await database.doTagsMatch(event))
            return false;
    else {
        if(results.length > 0) {
            for(let i = 0; i < results.length; i++) {
                let count = 0;
                for(let j = 0; j < results[i].tags.length; j++) {
                    for(let k = 0; k < event.tags.length; k++) {
                        if(results[i].tags[j] === event.tags[k])
                            count++;
                    }
                }
                if(count < 3) 
                    return true;
                count = 0;
            }
        }
        return true;
    }
    
};

const updateAddress = async(event: Event): Promise<Event> => {
    await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
            address : event.formatted_address,
            key : config.server.google_api_key
        }
    })
        .then(async response => {
            const city = response.data.results[0].address_components.filter((address: { types: string | string[]; }) => address.types.includes('locality'))[0].long_name;
            event.city = city;

            event.location.coordinates.push(response.data.results[0].geometry.location.lng);
            event.location.coordinates.push(response.data.results[0].geometry.location.lat);

            return event;
        });
    return event;
}

const uploadCity = async(event: Event) => {
    await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
            address : event.city,
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
            await database.insertCity(location);
        });
};

const getUser = async(req: Request): Promise<user> => {
    const response = await axios.get(`http://localhost:3000/getUser?id=${verify.getToken(req)}`);
    const user:user = {
        _id : response.data.user._id,
        name : response.data.user.name,
        email : response.data.user.email,
        phone_number : response.data.user.phone_number,
        follow_list : response.data.user.follow_list,
        verified : response.data.user.verified
    };
    return user;
}

function setDateTime(date: Date, time: string) {
    const index = time.indexOf(":"); // replace with ":" for differently displayed time.
    const index2 = time.indexOf(" ");

    let hours = Number.parseInt(time.substring(0, index));
    const minutes = Number.parseInt(time.substring(index + 1, index2));

    var mer = time.substring(index2 + 1, time.length);
    if (mer == 'PM' || mer == 'pm')
        hours += 12;

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0o0);
    
    return date;
}

const registerEvent = async(req : Request, res : Response): Promise<Response> => {
    const user = await getUser(req);
    const date = setDateTime(new Date(req.body.date), String(req.body.time));
    
    const isMorning = String(req.body.time).substring(String(req.body.time).indexOf(' ') + 1, String(req.body.time).length);

    const tags: string[] = [];

    for(let i = 0; i < req.body.tags.length; i++) {
        tags.push(String(req.body.tags[i]).toLowerCase());
    }

    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        host : user.name,
        date : new Date(String(req.body.date)),
        time : date.getHours() + ':' + (date.getMinutes() === 0 ? '00' : date.getMinutes()) + ' ' + isMorning,
        tags : tags,
        formatted_address : req.body.address,
        location : {
            type : 'Point',
            coordinates : []
        },
        city : req.body.city,
        rsvp : 0,
        available_slots : req.body.available_slots,
        organizations : req.body.organizations,
        online : req.body.online
    };
    
    const checkParameters = (event : Event) => {
        Object.values(event).every(value => {
            if(value === undefined) return true;
        });
        return false;
    }

    if(checkParameters(event))
        return res.status(401).json('one or many fields are undefined');

    if(await database.checkLocation(event.city)) {
        /*
            After this if statement you need to check to see if there are similar 
            events like this happening in the area
        */
        event = await updateAddress(event);
        if(await validateEvent(event)) {
            await database.insertEvent(event);
            return res.status(200).json({
                message : 'event successfully added',
                event
            });
        } else {
            return res.status(500).json('this event has too many events');
        }
    } else {

        await updateAddress(event);

        await database.insertEvent(event);

        if(!await database.checkLocation(event.city))
            await uploadCity(event);

        return res.status(200).json({
            message : 'event successfully added',
            event
        });
    }
}

const getEvents = async(req: Request, res: Response): Promise<Response> => {
    let events: Event[] = [];
    let include: boolean;
    const parameters: query = {
        name : req.body.event_name === undefined ? null : req.body.event_name,
        tags : req.body.tags === undefined ? null : req.body.tags,
        inclusive : req.body.inclusive === undefined ? null : req.body.inclusive,
        date : req.body.date === undefined ? null : new Date(req.body.date)
    };
    
    if(parameters.inclusive) include = true;
    else include = false;

    if(include) {
        if(parameters.name !== undefined && parameters.tags !== undefined && parameters.date !== undefined) {
            console.log('hello');
            console.log(parameters);
            const query = [{
                $match : { 
                    $and : [
                        { event_name : parameters.name},
                        { tags : parameters.tags },
                        { date : { $eq : parameters.date }}
                    ]
                }
            }];
            events = await database.getEvents(query);
        }
        
    }

    return res.status(200).json(events);
}

export default { registerEvent, getEvents }