import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Calling, Circling, Posting, Sessioning } from "./app";
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
    //await Posting.assertAuthorIsUser(oid, user);
    return await Posting.editPost(user, oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.post("/circles")
  async createCircle(session: SessionDoc, title: String, capacity: number) {
    const admin = Sessioning.getUser(session);
    const created = await Circling.createCircle(title, admin, capacity);
    //return { msg: created.msg, circle: await Responses.post(created.circle) };
    return { msg: created.msg, circle: created.circle}
  }

  @Router.get("/circles")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getCircles(filter?: string[]) {
    let circles;
    if (filter) {
      //filter circles based on title, tag, etc
    } else {
      circles = await Circling.getCircles();
    }
    return circles;
  }

  @Router.patch("/circles/:id")
  async editCircle(session: SessionDoc, id: string, newTitle: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.renameCircle(user, newTitle, oid);
  }

  @Router.patch("/circles/:id")
  async joinCircle(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.joinCircle(user, oid);
  }

  @Router.patch("/circles/:id")
  async leaveCircle(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Circling.leaveCircle(user, oid);
  }

  @Router.post("/calls")
  async startCall(session: SessionDoc, circle: string) {
    const admin = Sessioning.getUser(session);
    const circle_oid = new ObjectId(circle);
    const created = await Calling.startCall(admin, circle_oid);
    return { msg: created.msg, call: created.call}
  }

  @Router.patch("/calls/:id")
  async joinCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.joinCall(user, oid);
  }

  @Router.patch("/calls/:id")
  async switchParticipantModeInCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.switchParticipantMode(user, oid);
  }

  @Router.patch("/calls/:id")
  async callNextSpeakerInCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.callNextSpeaker(user, oid);
  }

  @Router.patch("/calls/:id")
  async muteSwitchInCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.muteSwitch(user, oid);
  }

  @Router.patch("/calls/:id")
  async leaveCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.leaveCall(user, oid);
  }

  @Router.patch("/calls/:id") //maybe delete? but i simply update the isOngoing property
  async endCall(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Calling.endCall(user, oid);
  }

  @Router.post("/events")
  async createEvent(session: SessionDoc) {
    //under development
    //will have two options: if recurrence given, set up single event, but if not, set up recurring event
  }

  @Router.get("/events:id")
  async getEventTime(session: SessionDoc, id: string) {
    //under development
  }

  @Router.get("/events")
  async getUpcomingEvents(session: SessionDoc) {
    //under development
  }

  @Router.delete("/events:id")
  async deleteEvent(session: SessionDoc,id: string) {
    //under development
  }


}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
