import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "./errors";

export interface CircleDoc extends BaseDoc {
    _id: ObjectId,
    title: String,
    admin: ObjectId,
    members: ObjectId[],
    capacity: Number
}


/**
 * concept: Circling
 */
export default class CirclingConcept {
    public readonly circles: DocCollection<CircleDoc>;
  
    /**
     * Make an instance of Circling
     */
    constructor(collectionName: string) {
      this.circles = new DocCollection<CircleDoc>(collectionName);
    }

    async createCircle(title: String, admin: ObjectId, capacity: number){
        const _id = await this.circles.createOne({
            title,
            admin,
            members: [],
            capacity
          });
          return { msg: 'Circle successfully started!', circle: await this.circles.readOne({ _id }) };
    }

    async joinCircle(user: ObjectId, circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
        
        //assert not circle member
        circle.members.push(participant);
        await this.circles.partialUpdateOne({ _id: circleId }, { members: circle.members });
        

        return { msg: "Joined the circle", circle };
      }

      async leaveCircle(user: ObjectId, circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
        
        //assert not admin
        circle.members = circle.members.filter((p) => !p.equals(user));
        
        await this.circles.partialUpdateOne({ _id: circleId }, { members: circle.members });
    
        return { msg: "Left the circl", circle };
      }




}