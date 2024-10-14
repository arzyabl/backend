import { ObjectId } from "mongodb";

import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";
//import adhan from 'adhan';

export interface CalendarDoc extends BaseDoc {
    _id: ObjectId,
    name: string,
    calendar: ObjectId,
    creator: ObjectId,
    startTime: Date,
    endTime: Date,
    type: string,
    recurrence?: [string, number],
}


/**
 * concept: Calendaring [Calendar]
 */
export default class CalendaringConcept {
    public readonly events: DocCollection<CalendarDoc>;                 // Map Date to weekday name
    public location?: string = "";                                       // Optional location for user-specific timings

  
    /**
     * Make an instance of Calendaring.
     */
    constructor(collectionName: string) {
        this.events = new DocCollection<CalendarDoc>(collectionName);
    }

    async createEvent(name: string, calendar: ObjectId, creator: ObjectId, startTime: Date, endTime: Date, type: string, recurrence?: [string, number]) {
        const _id = await this.events.createOne({ name, calendar,creator, startTime, endTime, type, recurrence});
        return { msg: "Event successfully created!", event: await this.events.readOne({ _id }) };
    }

    async createEventBasedOnPrayerTime( name: string, calendar: ObjectId, creator: ObjectId, type: string,
        dateStr: string, prayerName: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha',
        offsetMinutes: number=0, durationMinutes: number=60,
        latitude: number, longitude: number ,
        recurrence?: [string, number]){

        const date = new Date(dateStr);
        const location = { latitude: latitude, longitude: longitude };
        const prayerTimes = await this.getPrayerTimes(date, location);

        // Get the corresponding prayer time
        const prayerTime = prayerTimes[prayerName];

        if (!prayerTime) {
            throw new Error(`Invalid prayer time: ${prayerName}`);
          }
        const startTime = new Date(prayerTime.getTime() + offsetMinutes*60*1000);
        const endTime = new Date(startTime.getTime() + durationMinutes*60*1000);

        return await this.createEvent(name, calendar, creator, startTime, endTime, type, recurrence);
    }

    async editEvent(_id: ObjectId, name?: string, startTime?: Date, endTime?: Date, recurrence?: [string, number] ) {
        const event = await this.events.readOne({ _id });
        if (!event) {
            throw new NotFoundError(`Event ${_id} does not exist!`);
        }
        
        await this.events.partialUpdateOne({ _id }, { name, startTime, endTime, recurrence });
        return { msg: `Event successfully updated!`, event };
      }

      async getEventsOfCalendar(calendar: ObjectId) {
        return await this.events.readMany({calendar}, { sort: { _id: -1 } });
      }

      async getEvents(type?: string) {
        return await this.events.readMany({type}, { sort: { _id: -1 } });
      }

      async getEventById(_id: ObjectId) {
        const event = await this.events.readOne({ _id });
        if (!event) {
            throw new NotFoundError(`Event ${_id} does not exist!`);
        }
        return event;
        }

      async getStartTimeOfEvent( _id: ObjectId){
        const event = await this.events.readOne({ _id });
        if (!event) {
            throw new NotFoundError(`Event ${_id} does not exist!`);
        }
        return event.startTime;
        }

        async getEventDuration( _id: ObjectId){
            const event = await this.events.readOne({ _id });
            if (!event) {
                throw new NotFoundError(`Event ${_id} does not exist!`);
            }
            return event.endTime.getTime() - event.startTime.getTime();
        }   

        async isUpcoming(_id: ObjectId, upcoming: number){
            const event = await this.events.readOne({ _id });
            if (!event) {
                throw new NotFoundError(`Event ${_id} does not exist!`);
            }

            return event.startTime.getTime() - Date.now() <= upcoming; 
        }

        

        async assertUserIsCreator(_id: ObjectId, user: ObjectId){
            const event = await this.events.readOne({ _id });
            if (!event)  throw new NotFoundError(`Event ${_id} does not exist!`);
            
            if (event.creator.toString() !== user.toString()) throw new NotAllowedError(`User ${user} is not event creator.`);
            
        }

        async delete(_id: ObjectId) {
            await this.events.deleteOne({ _id });
            return { msg:`"Event ${_id} deleted successfully!` };
        }


        //islamic timings functions

        public async getPrayerTimes(date: Date, location: { latitude: number, longitude: number }) {
            const params = CalculationMethod.MuslimWorldLeague();
            const coordinates = new Coordinates(location.latitude, location.longitude);
            const prayerTimes = new PrayerTimes(coordinates, date, params);
    
            return prayerTimes;
        }

        async isDateHoliday(date: Date){
            const isHoliday = false;
            //under implementation
            return isHoliday
        }

        async getDateForHoliday(holiday: string){
            //under implementation
            throw new NotFoundError(`No holiday called {holiday}`);
        }

        async isDateJumah(date:Date){
            return date.getDay() === 5;
        }

}

