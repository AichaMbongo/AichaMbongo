import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.PROFILE_USERNAME;
const token = process.env.GH_TOKEN;

if (!username) throw new Error("PROFILE_USERNAME is required");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-card`,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const user = await github(`/users/${encodeURIComponent(username)}`);
const repositories = [];

for (let page = 1; ; page += 1) {
  const batch = await github(
    `/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}`,
  );
  repositories.push(...batch);
  if (batch.length < 100) break;
}

const stars = repositories.reduce(
  (total, repository) => total + repository.stargazers_count,
  0,
);
const forks = repositories.reduce(
  (total, repository) => total + repository.forks_count,
  0,
);

const values = [
  ["Public repositories", user.public_repos],
  ["Followers", user.followers],
  ["Stars earned", stars],
  ["Repository forks", forks],
];

const rows = values
  .map(([label, value], index) => {
    const x = index % 2 === 0 ? 32 : 310;
    const y = index < 2 ? 105 : 157;
    return `
      <circle cx="${x}" cy="${y - 5}" r="5" fill="#67e8f9"/>
      <text x="${x + 14}" y="${y}" class="label">${label}</text>
      <text x="${x + 220}" y="${y}" text-anchor="end" class="value">${value.toLocaleString("en-US")}</text>`;
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="580" height="190" viewBox="0 0 580 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${username}'s GitHub statistics</title>
  <desc id="desc">Public repositories, followers, stars earned, and repository forks.</desc>
  <style>
    .title { font: 600 22px 'Segoe UI', Ubuntu, sans-serif; fill: #67e8f9; }
    .label { font: 400 14px 'Segoe UI', Ubuntu, sans-serif; fill: #ffffff; }
    .value { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #67e8f9; }
    .updated { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: #9ca3af; }
  </style>
  <rect width="580" height="190" rx="8" fill="#0f0c29"/>
  <text x="28" y="45" class="title">GitHub Overview</text>
  <path d="M28 62 H552" stroke="#203a43"/>
  ${rows}
  <text x="552" y="178" text-anchor="end" class="updated">Updated daily from public GitHub data</text>
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/stats.svg", svg, "utf8");
