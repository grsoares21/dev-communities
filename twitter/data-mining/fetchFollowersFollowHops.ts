// this version of the script starts from the list that is on the devTwitters.json file and add all the profiles it finds
// with more than 800 followers to the queue

import { config } from "https://deno.land/x/dotenv/mod.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";

let devTwittersQueue: TwitterProfile[] = [];
const devTwittersQueued = new Set<string>();

type TwitterProfile = {
  id: string;
  name: string;
  username: string;
};

const queueExists = existsSync("../data/queue.json");

if(queueExists) {
  // already had a queue from a previous run, so we're continuing with that queue
  devTwittersQueue = JSON.parse(Deno.readTextFileSync("../data/queue.json"));
} else {
  // initializing queue from devTwitters.json
  const devTwitters = JSON.parse(
    Deno.readTextFileSync("../data/devTwitters.json")
  ) as TwitterProfile[];
  
  devTwittersQueue.push(...devTwitters);
}

devTwittersQueue.forEach(devProfile => devTwittersQueued.add(devProfile.id));


const env = config();

var requestOptions = {
  method: "GET",
  headers: {
    Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`,
  },
};

while (devTwittersQueue.length > 0) {
  console.log(`--- Twitters to be processed: ${devTwittersQueue.length} ---`);
  const devTwitter = devTwittersQueue.shift() as TwitterProfile;
  Deno.writeTextFileSync("../data/queue.json", JSON.stringify(devTwittersQueue));

  console.log(`--- Scraping followers for: ${devTwitter.name} ---`);
  const followers = new Map();

  let paginationToken: string | undefined = "";
  let gotRateLimited: boolean;

  do {
    console.log(
      `Number of followers scraped for ${devTwitter.name}: ${followers.size}`
    );

    gotRateLimited = false;

    let followersURL = `https://api.twitter.com/2/users/${
      devTwitter.id
    }/followers${
      paginationToken ? `?pagination_token=${paginationToken}` : ""
    }`;

    let followersResponse: Response = await fetch(followersURL, requestOptions);

    if (followersResponse.status === 429) {
      gotRateLimited = true;
      // TOO many requests, should wait 15 min before retrying
      const timestampOfLimitLift =
        parseInt(followersResponse.headers.get("x-rate-limit-reset") ?? "0") *
        1000;
      console.log(
        `Got rate limited, waiting until rate limit is lifted (${timestampOfLimitLift} epoch, ${new Date(
          timestampOfLimitLift
        ).toString()})`
      );
      await new Promise((resolve) =>
        setTimeout(() => resolve(null), timestampOfLimitLift - Date.now())
      );
    } else {
      let followersData: {
        data: TwitterProfile[];
        meta: { next_token?: string };
      } = await followersResponse.json();

      const followersFollowersCount = new Map<string, number>();
      let followersCountUrl = `https://api.twitter.com/1.1/users/lookup.json?user_id=${followersData.data
        .map((profile) => profile.id)
        .join(",")}`;

      let followersFollowersData: {
        id_str: string;
        followers_count: number;
      }[] = await fetch(followersCountUrl, requestOptions).then((data) =>
        data.json()
      );

      followersFollowersData.forEach((data) =>
        followersFollowersCount.set(data.id_str, data.followers_count)
      );

      followersData.data.forEach((user) => {
        followers.set(user.id, user);
        if (
          (followersFollowersCount.get(user.id) ?? 0) > 800 &&
          !devTwittersQueued.has(user.id)
        ) {
          devTwittersQueue.push(user);
          devTwittersQueued.add(user.id);
        }
      });
      console.log(
        `Pagination token: ${paginationToken}, Page size: ${followersData.data.length}`
      );
      paginationToken = followersData.meta.next_token;

      Deno.writeTextFileSync(
        `../data/individual-followers/${devTwitter.username}.csv`,
        [...followers.values()].map((follower) => follower.id).join(",")
      );
    }
  } while (paginationToken || gotRateLimited);
}
