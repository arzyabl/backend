import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface CircleDoc extends BaseDoc {
    _id: ObjectId,
    title: String,
    admin: ObjectId,
    members: ObjectId[],
    capacity: number,
    difficultylevel: String,
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

    async createCircle(title: String, admin: ObjectId, capacity: number, difficultylevel: String){
        const _id = await this.circles.createOne({
            title,
            admin,
            members: [admin],
            capacity,
            difficultylevel
          });
          return { msg: 'Circle successfully started!', circle: await this.circles.readOne({ _id }) };
    }

    async getCircles(filters?: {
      title?: string | { $regex: string; $options: string };
      admin?: ObjectId;
      member?: ObjectId;
      difficultylevel?: string;
    }) {
      const query: any = {}; 

      // Add optional filters if provided
      if (filters?.title) {
        query.title = filters.title;
      }
    
      if (filters?.admin) {
        query.admin = filters.admin;
      }
    
      if (filters?.member) {
        query.members = filters.member; 
      }
    
      if (filters?.difficultylevel) {
        query.difficultylevel = filters.difficultylevel;
      }
    
      // Query the database with the constructed filters
      const circles = await this.circles.readMany(query);
    
      if (circles.length === 0) {
        throw new NotFoundError(`No circles found with the provided filters.`);
      }
    
      return circles;
    }
    
    //gets circles the user is not member of
    async searchCircles(userId: ObjectId, keywords?: string[]) {
      let filter = {};
      if (keywords && keywords.length >= 0) {
        const regexPattern = keywords.map(keyword => `(${keyword})`).join('|'); // This will create a pattern like "(keyword1)|(keyword2)"
        filter = { title: { $regex: regexPattern, $options: 'i' } }
      }
  
      const allCircles = await this.getCircles(filter);
      const newCircles = allCircles.filter(circle => !circle.members.map(member => member.toString()).includes(userId.toString()));

      if (newCircles.length === 0) {
          throw new NotFoundError(`No new circles found for keywords: ${keywords ? keywords.join(', ') : " " }`);
      }
  
      return newCircles;
  }
  

    async getCircleById(_id: ObjectId) {
        const circle = await this.circles.readOne({ _id });
        if (circle === null) {
          throw new NotFoundError(`Circle not found!`);
        }
        return circle;
      }

      async getCircleAdmin(_id: ObjectId) {
        const circle = await this.circles.readOne({ _id });
        if (circle === null) {
          throw new NotFoundError(`Circle not found!`);
        }
        return circle.admin;
      }


    async joinCircle(user: ObjectId, circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
        
        await this.assertNotMemberIsUser(circleId, user);
        await this.assertCapacity(circleId);

        await circle.members.push(user);
        await this.circles.partialUpdateOne({ _id: circleId }, { members: circle.members });
        
        return { msg: "Joined the circle", circle };
      }

      async leaveCircle(user: ObjectId, circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
        
        await this.assertMemberIsUser(circleId, user);

        circle.members = circle.members.filter((p) => !p.equals(user));
        
        await this.circles.partialUpdateOne({ _id: circleId }, { members: circle.members });
    
        return { msg: "Left the circle", circle };
      }

      async deleteCircle(admin: ObjectId, circle_id: ObjectId) {
        const circle = await this.circles.readOne({ _id: circle_id });
      
        if (!circle) {
          throw new NotFoundError(`Circle ${circle_id} does not exist.`);
        }
        
        await this.assertAdminIsUser(circle_id, admin)
      
        await this.circles.deleteOne({ _id: circle_id });
      
        return { msg: `Circle ${circle_id} deleted successfully!` };
      }
      

      async renameCircle(admin: ObjectId, newTitle: String, circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
        
        await this.assertAdminIsUser(circleId, admin);
        
        circle.title = newTitle;
        await this.circles.partialUpdateOne({ _id: circleId }, { title: circle.title });
        
        return { msg: "Renamed the circle", circle };
      }

      async assertAdminIsUser(_id: ObjectId, user: ObjectId) {
        const circle = await this.circles.readOne({ _id });
        if (!circle) {
          throw new NotFoundError(`Circle ${_id} does not exist!`);
        }
        if (circle.admin.toString() !== user.toString()) {
          throw new CircleAdminNotMatchError(user, _id);
        }
      }

      async assertMemberIsUser(_id: ObjectId, user: ObjectId) {
        const circle = await this.circles.readOne({ _id });
        if (!circle) {
          throw new NotFoundError(`Circle ${_id} does not exist!`);
        }
        if (user.toString() ! in circle.members.map(m=> m.toString())) {
          throw new CircleMemberNotMatchError(user, _id);
        }
      }

      async assertNotMemberIsUser(_id: ObjectId, user: ObjectId) {
        const circle = await this.circles.readOne({ _id });
        if (!circle) {
          throw new NotFoundError(`Circle ${_id} does not exist!`);
        }
        if (circle.members.map(m=> m.toString()).includes(user.toString())) {
          throw new CircleNewMemberNotMatchError(user, _id);
        }
      }

      async assertCapacity(circleId: ObjectId) {
        const circle = await this.circles.readOne({ _id: circleId });
        if (!circle) throw new NotFoundError(`Circle ${circleId} does not exist`);
    
        const currentMembersCount = circle.members.length;
        const capacity = circle.capacity;
    
        if (capacity && currentMembersCount >= capacity) {
            throw new NotAllowedError(`Circle ${circleId} has reached its capacity of ${capacity}.`);
        }
    }
    

}

export class CircleAdminNotMatchError extends NotAllowedError {
  constructor(
    public readonly admin: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the admin of circle {1}!", admin, _id);
  }
}

export class CircleMemberNotMatchError extends NotAllowedError {
  constructor(
    public readonly member: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not a member of circle {1}!", member, _id);
  }
}

export class CircleNewMemberNotMatchError extends NotAllowedError {
  constructor(
    public readonly user: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is already a member of circle {1}!", user, _id);
  }
}