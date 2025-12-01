# Notable Issues Faced

There were many I forgot to record, but here are some:

## Zombie Processes when Killing Process in Alpine

Many of my challenges requires killing some sort of process. Since the base image of Alpine doesn't come with an `init` system (eg. Systemd), doing `kill pid` will cause the process to be a zombie since nothing will cleanup killed processes.

To fix this issue, I added `tini`, which is a small `init` system often used for Docker containers to ensure that processes are cleaned up.

## Race Condition Cleaning Up Websocket Resources

Initially, shutting down my application would lead to indefinite hang. This is because my websocket service  and session manager could potentially do a double "cleanup" of the websocket connection.

Basically, it goes as:

``` txt
sessionManager.endSession() 
  → calls ws.closeConnection()
  → triggers ws.on('close') event
  → calls cleanup() again
  → Both try to destroy same stream → HANG
```

In order to prevent this, I added a flag `cleanedUp` to the `ConnectionState` which basically acts as a thread lock to prevent race conditions.

## Docker Stream

I had many issues trying to setup the Docker container connection to browser with Websocket. My initial code basically was:

``` ts
const stream = await exec.start({});
await new Promise((resolve) => stream.on('end', resolve));
```

which hangs forever. The solution to this is to drain the stream since Node.js streams are lazy and won't emit 'end' until data is consumed, eg:

``` ts
let output = '';
stream.on('data', (chunk: Buffer) => {
  output += chunk.toString(); // MUST consume data!
});

await new Promise((resolve) => {
  stream.on('end', resolve); // Now fires correctly
});
```

## Terminal Output

I had problem where websocket receives data but `xterm.js` shows nothing in frontend. The cause was since without setting `Tty: true`, Docker exec sends multiplexed data with 8-byte protocol headers, instead we need to set `Tty: true` for raw stream.

In backend this looks like:


``` js
const exec = await container.exec({
  Cmd: ["/bin/bash"],
  Tty: true,  // ← Raw output, no multiplexing
});

const stream = await exec.start({ 
  hijack: true,
  Tty: true,  // ← Also needed here
});

// forward raw bytes directly
stream.on('data', (chunk) => ws.send(chunk));
```

in frontend we can receive the binary data:

``` js
ws.binaryType = 'arraybuffer';
ws.onmessage = (event) => {
  const data = new Uint8Array(event.data);
  terminal.write(data); // xterm.js expects Uint8Array
};
```

## Database Notes

Not really an issue, but using Write-Ahead Log (WAL) for SQLite provides more concurrency and is faster in most scenarios (according to documentation).

I choose SQLite instead of MongoDB or Postgres as it requires less overhead (less dependencies), doesn't need network connection (ie. no need Docker container to connect to Postgres or no need to setup a database elsewhere). It is also more preferable to use a relational database in my application as some tables have relationships.

It works fine for a quick school project, even if this were to serve hundreds of people it should be able to handle things given that my application isn't read-write heavy. For real-production use, Postgres would be more suitable.

## Challenge Loader

The current approach works fine for a small amount of challenges, where each challenge is a directory with a `challenge.yaml` for metadata and `setup.sh` and `validate.sh` scripts mounted as read-only + executable in the container. Each time we start the application it goes through the challenge directory and all the sub-directories to populate the DB.

However, if this were a real-production application, this approach is not favorable, as going through the directory and loading each challegne each time we need to make a change to a challenge is sub-optimal.

## Docker Mount Issue

Simple annoying issue, have to give the absolute path rather than relative when setting volume binds.
