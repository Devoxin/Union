import { hash, compare } from 'bcrypt';
import shortId from 'shortid';
import FlakeId from 'flakeid';

const r = require('rethinkdbdash')({
  db: `union${'production' !== process.env.NODE_ENV ? `_${process.env.NODE_ENV}` : ''}`,
  silent: 'test' === process.env.NODE_ENV
});

const idGenerator = new FlakeId({
  timeOffset: (2018 - 1970) * 31536000 * 1000
});

/**
 * Creates a user object with the provided username and password, and stores it in the DB
 * @param {String} username The username of the account to create
 * @param {String} password The password of the account to create
 * @returns {Promise<string>} Generated Uniontag (username#discrim)
 */
export async function createUser (username, password) {
  const id = idGenerator.gen();
  const discriminator = await rollDiscriminator(username);

  if (!discriminator) {
    throw new Error('Cannot generate unique discrim. Try a different username.');
  }

  await r.table('users').insert({
    id,
    username,
    discriminator,
    password: await hash(password, 10),
    servers: [],
    online: false
  });

  return `${username}#${discriminator}`;
}

/**
 * Updates an user with given data
 * @param {String} id User ID to update
 * @param {String} username Username
 * @param {String?} password New password (not updated if undefined or null)
 * @param {String?} avatarUrl New avatar (not updated if undefined, removed if null)
 * @param {Boolean?} admin If the user is an administrator or no (not updated if undefined or null)
 * @returns {Promise<string>} New Uniontag (username#discrim)
 */
export async function updateUser (id, username, password, avatarUrl, admin) {
  const discriminator = await rollDiscriminator(username);
  const update = { username, discriminator };
  if (password) {
    Object.assign(update, { password: await hash(password, 10) });
  }
  if (undefined !== avatarUrl) {
    Object.assign(update, { avatarUrl });
  }
  if (true === admin || false === admin) {
    Object.assign(update, { admin });
  }
  await r.table('users').get(id).update(update);
  return `${username}#${discriminator}`;
}

/**
 * Generates a random discriminator to allow re-use of username
 * @param {String} username Username associated with the discriminator
 * @returns {Promise<string>} Generated discriminator
 */
async function rollDiscriminator (username) {
  let discriminator;
  while (true) {
    discriminator = Math.floor(Math.random() * 9999 + 1).toString().padStart(4, '0');
    if (!await r.table('users').filter({ username, discriminator }).count().gt(0)) {
      break;
    }
  }

  return discriminator;
}

/**
 * Creates a server with the provided name and iconUrl
 * @param {String} name The name of the server
 * @param {String|null} iconUrl A URL leading to an image to be used as the server's icon (optional)
 * @param {String} owner Owner ID (snowflake)
 * @returns {Promise<Object|Null>} Server object
 */
export async function createServer (name, iconUrl, owner) {
  let largestId = 0;
  try {
    largestId = (await r.table('servers').max('id')).id;
  } catch (e) {}
  const id = largestId + 1;

  const server = {
    name,
    iconUrl,
    owner,
    id
  };

  await r.table('servers').insert(server);
  await addMemberToServer(owner, id);
  return getServer(id);
}

/**
 * Updates a server with given data
 * @param {String} id Server ID
 * @param {String} name New server name (not updated if undefined or null)
 * @param {String} iconUrl New server icon (not updated if undefined, removed if null)
 * @returns {Promise<void>}
 */
export async function updateServer (id, name, iconUrl) {
  const update = {};
  if (name) {
    Object.assign(update, { name });
  }
  if (undefined !== iconUrl) {
    Object.assign(update, { iconUrl });
  }
  await r.table('servers').get(id).update(update);
}

/**
 * Adds a member to a server
 * @param {String} username The member to add to the server
 * @param {Number} id The server to add the member to
 */
export async function addMemberToServer (username, id) {
  const user = await r.table('users').get(username);
  const server = await r.table('servers').get(id);

  if (!user || !server || user.servers.includes(id)) {
    return;
  }

  await r.table('users').get(username).update({
    servers: r.row('servers').append(id)
  });
}

/**
 * Validates username and password from the provided auth
 * @param {String} auth The authentication type + base64-encoded credentials
 * @returns {(Null|Object)} The user object if authentication was successful, otherwise null
 */
export async function authenticate (auth) {
  if (!auth) {
    return null;
  }

  const [type, creds] = auth.split(' ');

  if ('Basic' !== type || !creds) {
    return null;
  }

  const [username, password] = Buffer.from(creds, 'base64').toString().split(':');
  const [name, discriminator] = username ? username.split('#') : [];

  if (!username || !password || !name || !discriminator) {
    return null;
  }

  const user = await r.table('users').filter({ username: name, discriminator }).nth(0).default(null);

  if (!user) {
    return null;
  }

  const isPasswordValid = await compare(password, user.password);

  if (!isPasswordValid) {
    return null;
  }

  return user;
}

/**
 * Retrieves a list of users in the server with the provided serverId
 * @param {Number} serverId The user to get the servers of
 * @returns {Array<Object>} A list of users in the server
 */
export function getUsersInServer (serverId) {
  return r.table('users').filter(u => u('servers').contains(serverId)).without(['servers', 'password']);
}

/**
 * Checks whether a user is in a server
 * @param {String} userId The user to check the servers of
 * @param {Number} serverId The server to check the user's presence of
 * @returns {Boolean} Whether the user is in the server
 */
export function isInServer (userId, serverId) {
  return r.table('users').get(userId)('servers').contains(serverId).default(false);
}

/**
 * Gets a list of servers that the given user is in
 * @param {String} username Username of the user to retrieve the servers of
 * @returns {Promise<Array<Object>>} A list of servers that the user is in
 */
export async function getServersOfUser (username) {
  const user = await r.table('users').get(username);

  if (!user) {
    return []; // This shouldn't happen but you can never be too careful
  }

  return r.table('servers')
    .getAll(...user.servers)
    .merge(server => ({
      members: r.table('users').filter(u => u('servers').contains(server('id'))).without(['servers', 'password']).coerceTo('array')
    }));
}

/**
 * Updates the online status of the given user
 * @param {String} username Username of the user to update the presence of
 * @param {Boolean} online Whether the user is online or not
 */
export async function updatePresenceOf (username, online) {
  // Sometimes this generate errors in unit tests
  try {
    await r.table('users').get(username).update({ online }).run();
  } catch (e) { }
}

/**
 * Resets the online status of all members. Useful when the server is shutting down
 */
export function resetPresenceStates () {
  return r.table('users').update({ online: false });
}

/**
 * Updates the online status of the given user
 * @param {String} username Username of the user to update the presence of
 * @param {Boolean} online Whether the user is online or not
 */
export function getUser (username) {
  return r.table('users').get(username);
}

/**
 * Retrieves a user without private properties
 * @param {String} username The name of the user to retrieve
 * @returns {Object|Null} The user, if they exist
 */
export function getMember (username) {
  return r.table('users').get(username).without(['password', 'servers']);
}

/**
 * Removes a member from a server
 * @param {String} username The name of the user to kick from the server
 * @param {Number} serverId The server to remove the member from
 */
export function removeMemberFromServer (username, serverId) {
  return r.table('users')
    .get(username)
    .update({
      servers: r.row('servers').difference([serverId])
    });
}

/**
 * Returns the number of servers that the given user owns
 * @param {String} username The username to filter servers against
 * @returns {Number} The amount of servers the user owns
 */
export function getOwnedServers (username) {
  return r.table('servers').filter(s => s('owner').eq(username)).count();
}

/**
 * Retrieves a server from the database by its ID
 * @param {Number} serverId The ID of the server to retrieve
 * @returns {Object|Null} The server, if it exists
 */
export function getServer (serverId) {
  return r.table('servers')
    .get(serverId)
    .merge(server => ({
      members: r.table('users').filter(u => u('servers').contains(server('id'))).without(['servers', 'password']).coerceTo('array')
    }));
}

/**
 * Deletes a server by its ID
 * @param {Number} serverId The ID of the server to delete
 */
export async function deleteServer (serverId) {
  await r.table('servers').get(serverId).delete();
  await r.table('invites').filter(inv => inv('serverId').eq(serverId)).delete();

  await r.table('users')
    .filter(u => u('servers').contains(serverId))
    .update({
      servers: r.row('servers').difference([serverId])
    });
}

export async function deleteUser (userId) {
  await r.table('users').get(userId).delete();
}

/**
 * Checks if the given user is the owner of the given server
 * @param {String} username The name of the user to check
 * @param {Number} serverId The id of the server to check
 * @returns {Boolean} Whether or not the user owns the server
 */
export function ownsServer (username, serverId) {
  return r.table('servers').get(serverId)('owner').eq(username).default(false);
}

/**
 * Checks whether the server exists
 * @param {Number} serverId The id of the server to check
 * @returns {Boolean} Whether the server exists or not
 */
export function serverExists (serverId) {
  if (!serverId) {
    return false;
  }

  return r.table('servers').get(serverId).coerceTo('bool').default(false);
}

/**
 * Generates an invite for the specified server
 * @param {Number} serverId The server ID to associate the invite with
 * @param {String} inviter The user who generated the invite
 * @returns {String} The invite code
 */
export async function generateInvite (serverId, inviter) {
  const invite = shortId();

  await r.table('invites').insert({
    id: invite,
    serverId,
    inviter
  });

  return invite;
}

/**
 * Returns an invite object from the provided code
 * @param {String} code The code to lookup
 * @returns {Object|Null} The invite, if it exists
 */
export function getInvite (code) {
  return r.table('invites').get(code);
}

export async function storeMessage (id, author, server, contents) {
  await r.table('messages').insert({ id, author, server, contents, createdAt: Date.now() }).run();
}

export async function updateMessage (id, contents) {
  await r.table('messages').get(id).update({ contents });
}

export async function deleteMessage (id) {
  await r.table('messages').get(id).delete();
}

export function retrieveMessage (id) {
  return r.table('messages').get(id);
}

export function drain () {
  r.getPoolMaster().drain();
}
