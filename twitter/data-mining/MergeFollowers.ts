// script to merge all the individual followers id from the data-store/individual-followers folder into a single csv file
// written for Deno :-)

const followersByTwitter = [];

for await (const dirEntry of Deno.readDir("../data/individual-followers")) {
  if (dirEntry.isFile) {
    const name = dirEntry.name.replace(".csv", "");
    const followers = Deno.readTextFileSync(
      `../data/individual-followers/${dirEntry.name}`
    ).split(",");

    followersByTwitter.push({ name, followers });
  }
}

// sort in descending order by number of followers
followersByTwitter.sort((a, b) => b.followers.length - a.followers.length);

// start csv string with the twitter names in the header
let csvString = followersByTwitter.map((tt) => tt.name).join(",") + "\n";

for (let i = 0; i < followersByTwitter[0].followers.length; i++) {
  csvString +=
    followersByTwitter.map((tt) => tt.followers[i] ?? "").join(",") + "\n";
}

Deno.writeTextFileSync("../data/allFollowers.csv", csvString);
