import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Calendaring, Calling, Circling, Posting, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const user_id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(user_id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, circle: string, timePost?: Date,  options?: PostOptions) {
    const user = Sessioning.getUser(session);
    //get circle?
    const oid = new ObjectId(circle);
    const created = await Posting.addPost(user, content, oid);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async editPost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Posting.editPost(user, oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/circles/:id/leaderboard/posts")
  async getPostLeaderboard(session: SessionDoc, circle: string) {
    const user = Sessioning.getUser(session);
    const circle_id = new ObjectId(circle);
    await Circling.assertMemberIsUser(circle_id, user);
    
    const leaderboard = await Posting.getPostLeaderboard(circle_id);
    return leaderboard;
  }


  @Router.post("/circles")
  async createCircle(session: SessionDoc, title: String, capacity: number, difficultylevel: String) {
    const admin = Sessioning.getUser(session);
    const created = await Circling.createCircle(title, admin, capacity, difficultylevel);
    //add text limit validation for title and description
    return { msg: created.msg, circle: created.circle}
  }

  @Router.get("/circles")
  @Router.validate(z.object({
    title: z.string().optional(),
    admin: z.string().optional(),
    user: z.string().optional(),
    difficultylevel: z.string().optional(),
  }))
  async getCircles(
    title?: string,
    admin?: string,
    user?: string,
    difficultylevel?: string
  ) {
    const filters: any = {};
  
    if (title) filters.title = title;
    if (admin) filters.admin = new ObjectId(admin);
    if (user) filters.members = new ObjectId(user);
    if (difficultylevel) filters.difficultylevel = difficultylevel;
  
    return  await Circling.getCircles(filters);
  }

  @Router.get("/circles/search")
  async searchCircles(session: SessionDoc, keywordStr?: String){
    const user = Sessioning.getUser(session);
    let keywords: string[] = [];
    if (keywordStr){
      keywords = keywordStr.split(' ');
    }
    return await Circling.searchCircles(user, keywords)
  }
  

  @Router.patch("/circles/:id/title")
  async editCircle(session: SessionDoc, id: string, newTitle: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.renameCircle(user, newTitle, oid);
  }

  @Router.patch("/circles/:id/members")
  async joinCircle(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.joinCircle(user, oid);
  }

  @Router.delete("/circles/:id/members")
  async leaveCircle(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.leaveCircle(user, oid);
  }

  @Router.delete("/circles")
  async deleteCircle(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.deleteCircle(user, oid);
  }

  @Router.get("/calls")
  @Router.validate(z.object({ id: z.string().optional() }))
  async getCalls(id?: string) {
    let calls;
    if (id) {
      const oid =  new ObjectId(id)
      calls = await Calling.getCallById(oid);
    } else {
      calls = await Calling.getAllCalls();
    }
    return calls;
  }

  @Router.get("/calls/callers")
  async getCurrentCallOfUser(session: SessionDoc){
    const user = Sessioning.getUser(session);
    return await Calling.getCurrentCallOfUser(user);
  }

  @Router.post("/calls")
  async startCall(session: SessionDoc, circle: string) {
    const admin = Sessioning.getUser(session);
    const circle_oid = new ObjectId(circle);
    await Circling.assertAdminIsUser(circle_oid, admin);
    const created = await Calling.startCall(admin, circle_oid);
    return { msg: created.msg, call: created.call}
  }

  @Router.patch("/calls/:id/participants")
  async joinCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const call_oid = new ObjectId(id);
    const circle_oid = await Calling.getGroupOfCall(call_oid);
    //await Circling.assertMemberIsUser(circle_oid, user);
    return await Calling.joinCall(user, call_oid);
  }

  @Router.patch("/calls/:id/listeners")
  async listenerSwitch(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.listenerSwitch(user, oid);
  }

  @Router.patch("/calls/:id/next")
  async callNextSpeakerInCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.callNextSpeaker(user, oid);
  }

  @Router.patch("/calls/:id/speakers")
  async muteSwitch(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.muteSwitch(user, oid);
  }

  @Router.delete("/calls/:id/participants")
  async leaveCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.leaveCall(user, oid);
  }

  @Router.delete("/calls") 
  async endCallWithSummary(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    const call = await Calling.getCallById(oid);
    const content = `Call ${call._id} ended.` //add more specific info
    
    await Posting.addPost(user, content, call.group)
 
    return await Calling.endCall(user, oid);
  }

  @Router.post("/events")
    async createCircleEvent(
      session: SessionDoc,
      name: string,
      circle: string,
      type: string,
      startTimeStr: string,  
      endTimeStr?: string,   
      prayerName?: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', 
      offsetMinutes?: number, 
      durationMinutes?: number, 
      latitude?: number, longitude?: number, 
      recurrence?: [string, number]
    ) {
      const admin = Sessioning.getUser(session);
      const circle_id = new ObjectId(circle);
      await Circling.assertAdminIsUser(circle_id, admin);

      // event based on prayer time
      if (prayerName && latitude && longitude) {
        const created = await Calendaring.createEventBasedOnPrayerTime(
          name, circle_id, admin, type, startTimeStr, prayerName, offsetMinutes, durationMinutes, latitude, longitude, recurrence
        );
        return { msg: created.msg + " islamic", created };

      } else if (startTimeStr && endTimeStr) {
        // normal events with specific start and end times
        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);

        const created = await Calendaring.createEvent(name, circle_id, admin, startTime, endTime, type, recurrence);
        return { msg: created.msg, created };

      } else {
        throw new Error("You must provide either start/end times or prayer time details.");
      }
    }


  @Router.get("/events/:id/startTime")
  async getEventStartTime(id: string) {
    const oid = new ObjectId(id);
    return await Calendaring.getStartTimeOfEvent(oid);
  }

  @Router.get("/events")
  async getEvents(session: SessionDoc, _id?: string, circle?: string) {
    const user = Sessioning.getUser(session);
    if (circle){
      const circle_id = new ObjectId(circle);
      await Circling.assertMemberIsUser(circle_id, user);
      return await Calendaring.getEventsOfCalendar(circle_id);
    }

    if (_id){
      const oid = new ObjectId(_id);
      return await Calendaring.getEventById(oid);
    }

    return await Calendaring.getEvents();
  }

  @Router.delete("/events/:id")
  async deleteEvent(session: SessionDoc,_id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(_id);
    await Calendaring.assertUserIsCreator(oid, user);
    return await Calendaring.delete(oid);
  }

  @Router.patch("/events/:id")
  async editEvent(session: SessionDoc, _id: string, name?: string, startTime?: Date, endTime?: Date, recurrence?: [string, number]) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(_id);
    await Calendaring.assertUserIsCreator(oid, user);
    return await Calendaring.editEvent(oid, name, startTime, endTime, recurrence);
  }

  startUpcomingCallsCheck() {
    const CHECK_INTERVAL_CALLS = 60 * 1000; // every minute
    const CHECK_INTERVAL_HW = 60 * 60 * 1000; //every hour
    setInterval(async () => {
      await this.postAboutUpcomingEvents(10 * 60 * 1000, "call"); // before 1o min
    }, CHECK_INTERVAL_CALLS);
    setInterval(async () => {
      await this.postAboutUpcomingEvents(24 * 60 * 60 * 1000, "deadline"); //before 24 hours
    }, CHECK_INTERVAL_HW);
  }


  async postAboutUpcomingEvents(timeUntil: number, type: string) {
    const upcomingTimeLimit = timeUntil; 

    const events = await Calendaring.getEvents(type); // Fetch your events

    for (const event of events) {
        const isEventUpcoming = await Calendaring.isUpcoming(event._id, upcomingTimeLimit);
        if (isEventUpcoming) {
          const message = `Upcoming event ${event.name} at ${event.startTime}`;
          const circle_id = event.calendar;
          const admin = await Circling.getCircleAdmin(circle_id);
          await Posting.addPost(admin, message, circle_id);
        }
    }
  }


}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
