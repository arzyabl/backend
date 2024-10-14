import AuthenticatingConcept from "./concepts/authenticating";
import CalendaringConcept from "./concepts/calendaring";
import CallingConcept from "./concepts/calling";
import CirclingConcept from "./concepts/circling";
import FriendingConcept from "./concepts/friending";
import PostingConcept from "./concepts/posting";
import SessioningConcept from "./concepts/sessioning";


// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const Circling = new CirclingConcept("circles");
export const Calling = new CallingConcept("calls");
export const Calendaring = new CalendaringConcept("events");
