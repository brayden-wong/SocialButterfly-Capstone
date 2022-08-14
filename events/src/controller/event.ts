import { Response, Request, response } from 'express';
import { ObjectId } from 'mongodb';
import { request } from '../request.helper';
import Event from '../interfaces/event';
import Location from '../interfaces/location';
import config from '../config/config';
import database from '../database/event';
import range from '../interfaces/range';
import query from '../interfaces/query';
import user from '../interfaces/user';
import verify from '../middleware/verify';
import eureka from '../eureka-helper';

setTimeout(() => {
    eureka.registerService('events', Number.parseInt(config.server.port));
}, 15000);

const getMeters = (miles: number) => {
    console.log(miles);
    console.log('conversion:', miles * 1609.344);
    return miles * 1609.344;
}

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
    if(results.length === 0)
        return true;
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

const updateAddress = async(event: Event): Promise<Event | null> => {
    const response = await request('https://maps.googleapis.com/maps/api/geocode/json', 'get', { address : event.formatted_address, key : config.server.google_api_key });
    if(response === null)
        return null;
    const city = response.data.results[0].address_components.filter((address : {types: string | string[]; }) => address.types.includes('locality'))[0].long_name;
    event.city = city;
    event.location.coordinates.push(response.data.results[0].geometry.location.lng);
    event.location.coordinates.push(response.data.results[0].geometry.location.lat);
    event.formatted_address = response.data.results[0].formatted_address;
    
    return event;
}

const uploadCity = async(event: Event) => {

    const response = await request('https://maps.googleapis.com/maps/api/geocode/json', 'get', 
        { address : event.city, key : config.server.google_api_key });

    if(response === null)
        return null;
    const location: Location = {
        _id : new ObjectId(),
        location : {
            type : 'Point',
            city : response.data.results[0].address_components.filter((address : { types : string | string[];}) => address.types.includes('locality'))[0].long_name,
            coordinates : [
                response.data.results[0].geometry.location.lng,
                response.data.results[0].geometry.location.lat
            ]
        }
    };
    await database.insertCity(location);
};

const getUser = async(req: Request): Promise<user | null> => {
    const id = verify.getToken(req);
    const response = await request(`http://gateway:8080/users/getUser`, 'get', { id : id });
    if(response === null || response.data === null)
        return null;
    return response.data.data as user;
}

const setDateTime = (date: Date, time: string): Date => {
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
    if(user === null || !user.verified)
        return res.status(500).json('user is not verified or no user was returned');
    const date = setDateTime(new Date(req.body.date), String(req.body.time));
    
    const isMorning = String(req.body.time).substring(String(req.body.time).indexOf(' ') + 1, String(req.body.time).length);

    const tags: string[] = [];

    for(let i = 0; i < req.body.tags.length; i++) {
        tags.push(String(req.body.tags[i]).toLowerCase());
    }

    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        host : {
            id : user._id,
            name : user.name
        },
        date : new Date(String(req.body.date)),
        time : date.getHours() + ':' + (date.getMinutes() === 0 ? '00' : date.getMinutes()) + ' ' + isMorning,
        tags : tags,
        formatted_address : req.body.address,
        location : {
            type : 'Point',
            coordinates : []
        },
        city : req.body.city,
        rsvp : [],
        available_slots : req.body.available_slots === undefined || req.body.available_slots === 0 ? -1 : req.body.available_slots,
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
    
    if(event.online) {
        //@ts-ignore
        delete event.location;
        //@ts-ignore
        delete event.city;
        //@ts-ignore
        delete event.formatted_address;

        await database.insertEvent(event);
        return res.status(200).json('event successfully added');
    }

    const followerList = async(list: string[], name: string) => {
        if(list.length === 0)
            return;
        
        list.forEach(email => {
            let options = {
                from : '',
                to: email,
                subject: 'Social Butterfly Event Notification',
                html : `Hello! This is a friendly notification that ${name} has created a new event.<br>
                <a href='http://localhost:3001/getOne?id=${event._id}>click here</a> to see the event`
            }

            request('http://gateway:8080/consumer/sendmail', 'post', undefined, {
                options
            });
        });
    }

    if(await database.checkLocation(event.city)) {
        /*
            After this if statement you need to check to see if there are similar 
            events like this happening in the area
        */
        const response = await updateAddress(event);
        if(response !== null)
            event = response;
        if(await validateEvent(event)) {
            const userData = await request(`http://gateway:8080/users/getUser?id=${event.host.id}`, 'get');
            if(userData === undefined) 
                return res.status(500).json('an error has occurred');
            if(userData !== null)
                followerList(userData.data.data.follow_list, event.host.name);
            await database.insertEvent(event);
            return res.status(200).json({
                message : '😄 event successfully added',
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
            message : '😄 event successfully added',
            event
        });
    }
}

const getEvents = async(req: Request, res: Response): Promise<Response> => {
    const temp = new Date();
    const parameters: query = {
        tags : req.body.tags === undefined ? [] : req.body.tags,
        dates : req.body.dates === undefined ? [new Date(temp.getFullYear(), temp.getMonth(), temp.getDate())] : req.body.dates.length === 2 ? req.body.dates : [new Date(req.body.dates)], //req.body.dates.length === 2 ? req.body.dates : req.body.dates,
        city : String(req.body.city),
        radius : req.body.radius === undefined ? 50 : Number.parseInt(req.body.radius),
        online : req.body.online === undefined ? undefined : req.body.online
    }; 
    if(parameters.radius > 50)
        return res.status(500).json({
            error: 'radius is too large'
        });

    const city = await database.cityLocation(parameters.city);

    if(city === null) 
        return res.status(500).json('that city doesn\'t exist');
    
    console.log(parameters.online);
    console.log(getMeters(parameters.radius));
    if(parameters.online === true) {
        const query = {
            $and : [
                parameters.tags.length === 0 ? { tags : { $exists : true, $not : { $size : 0 }}} : { tags : { $in : parameters.tags }},
                parameters.dates.length === 2 ? { $and : [
                    { date : { $gte : new Date(parameters.dates[0])}},
                    { date : { $lte : new Date(parameters.dates[1])}}
                ]} : {
                    $and : [
                        { date : { $gte : parameters.dates[0]}},
                        { date : { $lt : new Date(parameters.dates[0].getFullYear(), parameters.dates[0].getMonth(), parameters.dates[0].getDate() + 1)}}
                    ]
                },
                { online : true }
            ]
        }
        return res.status(200).json(await database.getEvents(undefined, query));
    }

    const query = [{
        $geoNear : {
            near : { type : 'Point', coordinates : [city.location.coordinates[0], city.location.coordinates[1]]},
            query : { $and : [
                parameters.tags.length === 0 ? { tags : { $exists : true, $not : { $size : 0 }}} : {tags : { $in : parameters.tags }},
                parameters.dates.length === 2 ? { $and : [
                    { date : { $gte : new Date(parameters.dates[0])}},
                    { date : { $lte : new Date(parameters.dates[1])}}
                ]} : { $and : [
                    { date : { $gte : parameters.dates[0]}},
                    { date : { $lt : new Date(parameters.dates[0].getFullYear(), parameters.dates[0].getMonth(), parameters.dates[0].getDate() + 1)}}
                ]},
                { city : new RegExp(parameters.city, 'i')},
                { online : false }
            ]},
            maxDistance : getMeters(parameters.radius),
            distanceField : 'dist.calculated',
            spherical : true
        }
    }];

    return res.status(200).json(await database.getEvents(query, undefined));
    
}

const nearMe = async(req: Request, res: Response) => {
    const user = await getUser(req);
    if(user === null)
        return res.status(500).json('user does not exist');
    if(user.base_location.city !== null)
        return res.status(200).json(await database.nearMe(user));
    return res.status(200).json(user.base_location.city);
    
}

const searchByTags = async(req: Request, res: Response): Promise<Response> => {
    const distances: {[key: number]: number } = {
        10 : 16093.4,
        25 : 40233.6,
        50 : 80467.2
    };

    if(req.body.tags !== undefined && req.body.city !== undefined && req.body.distance !== undefined) {
        const city = String(req.body.city);
        const filters = req.body.tags;
        const getRadius = (distance: number): number => {
            for(const [k, v] of Object.entries(distances)) 
                if(k === distance.toString())
                    return v
            return -1;
        };

        const radius = getRadius(Number.parseInt(req.body.distance));;
        if(radius === -1)
            return res.status(500).json('invalid radius');
        
        if(filters.length > 5 || filters.length === 0)
            return res.status(500).json({
                message : 'too many filters or you don\'t have any filters'
            });
        
        return await database.searchByTags(res, city, radius, filters);
    } else 
        return res.status(500).json('no filters were sent in the body');
}

const rsvp = async(req: Request, res: Response): Promise<Response> => {
    const user = await getUser(req);
    if(user === null)
        return res.status(500).json('user does not exist');
    const id = new ObjectId(String(req.query.id));
    if(user.verified)
        return await database.rsvp(res, id, user);
    return res.status(500).json('you have to be a verified user to rsvp to events');
}

const checkLocation = async(req: Request, res: Response): Promise<Response> => {
    const city = String(req.body.city);

    const exists = await database.checkLocation(city);

    if(exists)
        return res.status(200).json(true);

    const response = await request('https://maps.googleapis.com/maps/api/geocode/json', 'get', { address : city, key : config.server.google_api_key });
    if(response === null)
        return res.status(500).json({city : city, error: 'does not exist' });
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
    return res.status(200).json(false);
}

const validateLocation = async(req: Request, res: Response): Promise<Response> => {

    let user = req.body.user as user;

    user = await database.validateLocation(user);

    return res.status(200).json(user);
}

const updateEvent = async(req: Request, res: Response): Promise<Response> => {
    const oldEmail = req.body.oldEmail;
    const newEmail = req.body.newEmail;

    return await database.updateEvent(res, newEmail, oldEmail);
}

const getOneEvent = async(req: Request, res: Response) => {
    res.status(200).json(await database.oneEvent(String(req.query.id)));
}

export default { updateEvent, registerEvent, getEvents, searchByTags, rsvp, nearMe, checkLocation, validateLocation, getOneEvent }