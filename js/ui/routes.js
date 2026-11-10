// The app's addresses, in one place. They live in the URL's hash, so the app
// works from whatever folder it is served from.
//
//   #/                        Home
//   #/day/<day>               Day
//   #/day/<day>/<variation>   Variation
//   #/workout                 Player (only while a workout is in progress)
//   #/done                    Finish (only straight after a workout)
//   #/about                   About

export const HOME = "#/";
export const ABOUT = "#/about";
export const WORKOUT = "#/workout";
export const DONE = "#/done";

export const dayAddress = (dayId) => `#/day/${dayId}`;
export const variationAddress = (dayId, variationId) => `${dayAddress(dayId)}/${variationId}`;

// "#/day/glutes/hip-thrust" names the day "glutes" and the variation
// "hip-thrust"; any other address names neither.
export function workoutInAddress(hash) {
  const [, section, dayId, variationId] = hash.split("/");
  return section === "day" ? { dayId, variationId } : {};
}
