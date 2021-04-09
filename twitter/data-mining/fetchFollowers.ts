import { config } from "https://deno.land/x/dotenv/mod.ts";

type TwitterProfile = {
  id: string;
  name: string;
  handle: string;
};

const devTwitters = JSON.parse(
  Deno.readTextFileSync("../data/devTwitters.json")
) as TwitterProfile[];
const env = config();

var requestOptions = {
  method: "GET",
  headers: {
    Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`,
  },
};

for (let i = 0; i < devTwitters.length; i++) {
  const devTwitter = devTwitters[i];
  console.log(`--- Scraping followers for: ${devTwitter.name}`);
  const followers = new Map();

  let paginationToken: string | undefined = "";
  let gotRateLimited = false;

  do {
    console.log(
      `Number of followers scraped for ${devTwitter.name}: ${followers.size}`
    );

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
        data: { id: string }[];
        meta: { next_token?: string };
      } = await followersResponse.json();

      followersData.data.forEach((user) => followers.set(user.id, user));
      console.log(
        `Pagination token: ${paginationToken}, Page size: ${followersData.data.length}`
      );
      paginationToken = followersData.meta.next_token;

      Deno.writeTextFileSync(
        `../data/individual-followers/${devTwitter.name}.csv`,
        [...followers.values()].map((follower) => follower.id).join(",")
      );
    }
  } while (paginationToken || gotRateLimited);
}
