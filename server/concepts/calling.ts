import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface CallDoc extends BaseDoc {
    _id: ObjectId,
    group: ObjectId,
    admin: ObjectId,
    participants: ObjectId[],
    listeners: ObjectId[],
    speakerQueue: ObjectId[],
    speakers: ObjectId[] 
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
    await this.assertUserNotOnACall(admin);
    
    const _id = await this.calls.createOne({
      admin,
      group,
      participants: [],
      listeners: [],
      speakerQueue: [],
      speakers: [],
    });
    
    return { msg: "Call successfully started!", call: await this.calls.readOne({ _id }) };
  }

  async getAllCalls() {
    return await this.calls.readMany({}, { sort: { _id: -1 } });
  }

  

  async getCallsByGroup(group: ObjectId) {
    return await this.calls.readMany({ group }, { sort: { timePost: -1 } });
  }

  async getCallById(id: ObjectId){
    const call = await this.calls.readOne({ _id: id });
    if (!call) throw new NotFoundError(`Call ${id} does not exist`);
    return call;
  }

  async getGroupOfCall(id: ObjectId){
    const call = await this.calls.readOne({ _id: id });
    if (!call) throw new NotFoundError(`Call ${id} does not exist`);
    return call.group;
  }

  async getCurrentCallOfUser(userId: ObjectId) {
    const currentCall = await this.calls.readOne({
      $or: [
        { participants: userId }, 
        { admin: userId },       
      ],
    });
  
    if (!currentCall) {
      throw new NotFoundError(`User ${userId} is not currently on any call.`);
    }
  
    return currentCall;
  }
  
  
 
  async joinCall(participant: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
    
    //if not on a call already (including this one) 
    await this.assertUserNotOnACall(participant);
    await this.assertUserNotAdmin(callId, participant);
    
    call.participants.push(participant);
    call.speakerQueue.push(participant);

    await this.calls.partialUpdateOne({ _id: callId }, { participants: call.participants , speakerQueue: call.speakerQueue});

    return { msg: "Joined the call", call };
  }

  

  async listenerSwitch(participant: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);

    await this.assertUserOnCall(callId, participant);

    //const isListener = call.listeners.some(l => l.toString() === participant.toString());
    const isListener = call.listeners.some(l => l.toString() === participant.toString());

    if (isListener) {
      // remove from listeners
      call.listeners = call.listeners.filter(l => l.toString() !== participant.toString());
      if (!call.speakerQueue.map(l=> l.toString()).includes(participant.toString())) {
        call.speakerQueue.push(participant);
      }

    } else {
      // Move participant to listeners
      call.listeners.push(participant);
      call.speakerQueue = call.speakerQueue.filter((s) => s.toString() !== participant.toString());
    }

    await this.calls.partialUpdateOne({ _id: callId }, { listeners: call.listeners, speakerQueue: call.speakerQueue });

    return { msg: `Switched mode to ${isListener ? "participant": "listener"}`, call };
  }

  async callNextSpeaker(admin: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);

    await this.assertUserIsAdmin(callId, admin);

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

    await this.assertUserOnCall(callId, user);

    const isCurrentlySpeaker = call.speakers.some(speaker => speaker.toString() === user.toString());

    if (isCurrentlySpeaker) {
      //mute
        call.speakers = call.speakers.filter(speaker => speaker.toString() !== user.toString());
    } else {
        //unmute
        call.speakers.push(user);
    }

    await this.calls.partialUpdateOne({ _id: callId }, { speakers: call.speakers });

    return { msg: `User ${user.toString()} mute status changed`, speakers: call.speakers };
}


  async leaveCall(user: ObjectId, callId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call ${callId} does not exist`);
    
    await this.assertUserNotAdmin(callId, user);

    await this.assertUserOnCall(callId, user);

    call.participants = call.participants.filter((p) => !p.equals(user));
    call.listeners = call.listeners.filter((l) => !l.equals(user));
    call.speakerQueue = call.speakerQueue.filter((s) => !s.equals(user));

    await this.calls.partialUpdateOne({ _id: callId }, { participants: call.participants, listeners: call.listeners });

    return { msg: "Left the call", call };
  }

  async endCall(admin: ObjectId, _id: ObjectId) {
    const call = await this.calls.readOne({ _id: _id });
    if (!call) throw new NotFoundError(`Call ${_id} does not exist`);
    
    await this.assertUserIsAdmin(_id, admin);

    await this.calls.deleteOne({ _id});

    return { msg: "Call ended successfully" };
  }



  async assertUserNotOnACall(userId: ObjectId) {
    const activeCall = await this.calls.readOne({
      $or: [
        { participants: userId },  // Check if the user is a participant
        { admin: userId },         // Check if the user is the admin
      ],
    });
  
    if (activeCall) {
      throw new NotAllowedError(`User ${userId} is already in call ${activeCall._id}.`);
    }
  }
  

  async assertUserOnCall(callId: ObjectId, userId: ObjectId) {
    const call = await this.calls.readOne({ _id: callId });
    if (!call) throw new NotFoundError(`Call with ID ${callId} does not exist.`);
  
    const isUserInCall = call.participants.some(p => p.equals(userId));
    if (!isUserInCall) {
      throw new NotAllowedError(`User ${userId} is not a participant in call ${call._id}.`);
    }
  }


  async assertUserIsAdmin(_id: ObjectId, user: ObjectId) {
    const call = await this.calls.readOne({ _id });
    if (!call) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (call.admin.toString() !== user.toString()) {
      throw new NotAllowedError(`User ${user} is not admin of call ${_id}.`);
    }
  }

  async assertUserNotAdmin(_id: ObjectId, user: ObjectId) {
    const call = await this.calls.readOne({ _id });
    if (!call) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (call.admin.toString() === user.toString()) {
      throw new NotAllowedError(`User ${user} is the admin of call ${_id}.`);
    }
  }



}