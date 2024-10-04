import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface CallDoc extends BaseDoc {
    _id: ObjectId,
    group: ObjectId,
    admin: ObjectId,
    participants: ObjectId[],
    listeners: ObjectId[],
    isOngoing: Boolean,
    speakerQueue: ObjectId[],
    isMuted: Map<ObjectId, Boolean> 
}
    

/**
 * concept: Calling [Caller, Circle]
 */
export default class CallingConcept {
  public readonly calls: DocCollection<CallDoc>;

  /**
   * Make an instance of Calling
   */
  constructor(collectionName: string) {
    this.calls = new DocCollection<CallDoc>(collectionName);
  }

  async startCall(admin: ObjectId, group: ObjectId) {
    const _id = await this.calls.createOne({
      admin,
      group,
      participants: [],
      listeners: [],
      isMuted: new Map(),
      speakerQueue: [],
      isOngoing: true,
    });
    return { msg: "Call successfully started!", call: await this.calls.readOne({ _id }) };
  }
 
  async joinCall(participant: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
    // asset user circle member
    if (!call.participants.includes(participant)) {
      call.participants.push(participant);
      await this.calls.partialUpdateOne({ _id: callId }, { participants: call.participants });
    }

    return { msg: "Joined the call", call };
  }

  async switchParticipantMode(participant: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
    //asser user is circle member
    const isListener = call.listeners.includes(participant);

    if (isListener) {
      // Move listener to participants
      call.listeners = call.listeners.filter((l) => !l.equals(participant));
      call.participants.push(participant);
    } else {
      // Move participant to listeners
      call.participants = call.participants.filter((p) => !p.equals(participant));
      call.listeners.push(participant);
    }

    await this.calls.partialUpdateOne({ _id: callId }, { participants: call.participants, listeners: call.listeners });

    return { msg: "Switched mode", call };
  }

  async callNextSpeaker(admin: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);

    //asserAdmin instead
    if (call.admin.toString() !== admin.toString()) {
      throw new Error("Only the admin can call the next speaker");
    }

    const nextSpeaker = call.speakerQueue.shift();
    if (!nextSpeaker) {
      return { msg: "No more speakers in the queue" };
    }

    await this.calls.partialUpdateOne({ _id: callId }, { speakerQueue: call.speakerQueue });

    return { msg: "Next speaker called", speaker: nextSpeaker };
  }


  async muteSwitch(user: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
  
    const userIdStr = user.toString();
    const isCurrentlyMuted = call.isMuted.get(user) ?? false;
    call.isMuted.set(user, !isCurrentlyMuted);
  
    await this.calls.partialUpdateOne({ _id: callId }, { isMuted: call.isMuted });
  
    return { msg: `User ${userIdStr} mute status changed`, isMuted: call.isMuted.get(user) };
  }


  async leaveCall(user: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);

    call.participants = call.participants.filter((p) => !p.equals(user));
    call.listeners = call.listeners.filter((l) => !l.equals(user));

    await this.calls.partialUpdateOne({ _id: callId }, { participants: call.participants, listeners: call.listeners });

    return { msg: "Left the call", call };
  }

  async endCall(admin: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
    //assert admin
    if (call.admin.toString() !== admin.toString()) {
      throw new NotAllowedError("Only the admin can end the call");
    }

    await this.calls.partialUpdateOne({ _id: callId }, { isOngoing: false });

    return { msg: "Call ended successfully" };
  }

}