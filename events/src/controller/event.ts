import { Response, Request } from 'express';
import { ObjectId } from 'mongodb';
import Event from '../interfaces/event';
import axios from 'axios';
import Location from '../interfaces/location';
import config from '../config/config';
import database from '../database/event';
import range from '../interfaces/range';


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
        return false;
    }
    return true;
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

            console.log(event);

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
}

const registerEvent = async(req : Request, res : Response): Promise<Response> => {
    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        date : new Date(),
        tags : req.body.tags,
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

        if(await validateEvent(event)) {
            event = await updateAddress(event);
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

export default { registerEvent }