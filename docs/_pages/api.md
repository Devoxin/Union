---
layout: docs
permalink: /api
title: Union API
---

# API Standards

Api root: `/api`

Union API uses REST methods, because our server is too lazy and needs to rest. Wait what??<br>
**Note**: Union API is not *fully* REST, and PUT method is interpreted as a PATCH method. This behaviour should not
cause any problems, but don't forget that a PUT request with partial data won't be rejected.

Snowflakes are returned as a string by the API to prevent integer overflows in some languages (Snowflakes can be
64bit integer and some languages like JavaScript cannot process it natively)

## Versions

| Version      | Status           |
|--------------|------------------|
| v1           | Removed          |
| v2 (default) | Available        |

## Authentication

You can authenticate your requests in 3 ways:
 - Using a Basic token
 - Using an Oauth2 token (*coming soon*)
 - Using your bot token (*coming soon*)

## Rate Limiting

To prevent excessive abuse of our API and overall slowdowns, we use rate limiting on a per-route basis
(with a global rate very high rate limiting)

### Headers

Union API uses standard rate limiting headers:

```
X-RateLimit-Limit: xxxxxx
X-RateLimit-Remaining: xxxxxx
Retry-After: xxxxxx
```

### Rates

| Scope       | Rate                              |
|-------------|-----------------------------------|
| Per-route   | 5 req/s                           |
| Global      | 500 req/50s, 5min ban if reached* |

*\*Will ban from the API **AND** the socket*

# Endpoints

## Core

### Root

<span class='api-endpoint'><span class='sun-flower-text'>GET</span> /</span>

Move along, nothing to see citizen

### API Info

<span class='api-endpoint'><span class='sun-flower-text'>GET</span> /info</span>

 - Response data

| Field             | Type    | Description                                  |
|-------------------|---------|----------------------------------------------|
| apiVersion        | int     | Version of the API                           |
| websocket         | int     | Port the socket is listening to              |
| voice             | int     | *Not implemented*                            |
| appSettings       | object  | All rules configured in `Configuration.json` |
| recaptcha         | object  |                                              |
| recaptcha.enabled | boolean | Whenever or not reCAPTCHA is enabled         |
| recaptcha.key     | string? | Public key for reCAPTCHA widget              |

## Users

### Create an user

<span class='api-endpoint'><span class='sun-flower-text'>POST</span> /users</span>

 - Request data

| Field                | Type   | Description                                                    | Required       |
|----------------------|--------|----------------------------------------------------------------|----------------|
| username             | string | Username (cannot exceed the limit of `usernameCharacterLimit`) | yes            |
| password             | string | Password, must be 5 characters long or more                    | yes            |
| g-recaptcha-response | string | Response returned by Google reCaptcha                          | yes if enabled |

 - Response

400 on failure with the error message `{ "error": "no u" }`<br>
200 on success with the user tag `{ "id": "0o-Xx_FoRtNiTe_xX-o0#0666" }`

### Get current user

<span class='api-endpoint'><span class='sun-flower-text'>GET</span> /users/self</span>
<span class='api-auth'>Requires authentication</span>

 - Response data

| Field         | Type      | Description                           |
|---------------|-----------|---------------------------------------|
| id            | snowflake | User internal ID                      |
| username      | string    | Username                              |
| discriminator | int       | Discriminator for the user            |
| avatarUrl     | string?   | Url of the user's avatar              |
| servers       | int[]     | List of the server IDs the user is in |
| online        | boolean   | Whether or not the user is online     |

### Update the current user

<span class='api-endpoint'><span class='sun-flower-text'>PUT/PATCH</span> /users/self</span>
<span class='api-auth'>Requires authentication</span>

 - Request data (All fields are optional)

| Field     | Type   | Description                                                    |
|-----------|--------|----------------------------------------------------------------|
| username  | string | Username (cannot exceed the limit of `usernameCharacterLimit`) |
| password  | string | Password, must be 5 characters long or more                    |
| avatarUrl | string | Url of the user's avatar                                       |

 - Response

204 on success, 400 on failure

### Delete the current user

<span class='api-endpoint'><span class='sun-flower-text'>DELETE</span> /users/self</span>
<span class='api-auth'>Requires authentication</span>

 - Request data

| Field    | Type   | Description                  |
|----------|--------|------------------------------|
| password | string | Current password of the user |

 - Response

204 on success, 401 if invalid password

## Servers

### Create a server

<span class='api-endpoint'><span class='sun-flower-text'>POST</span> /servers</span>
<span class='api-auth'>Requires authentication</span>

**Note:** You can't exceed the `maxServersPerUser` limit

 - Request data

| Field   | Type   | Description        |
|---------|--------|--------------------|
| name    | string | Name of the server |
| iconUrl | string | Icon of the server |

 - Response

204 on success, 400 on failure

### Update a server

<span class='api-endpoint'><span class='sun-flower-text'>PUT/PATCH</span> /servers/<span class='emerald-text'>:serverId</span></span>
<span class='api-auth'>Requires authentication and <span class='sun-flower-text'>SERVER_OWNER</span> permission</span>

 - Request data (All fields are optional)

| Field   | Type   | Description        |
|---------|--------|--------------------|
| name    | string | Name of the server |
| iconUrl | string | Icon of the server |

 - Response

204 on success, 400 on failure

### Leave a server

<span class='api-endpoint'><span class='sun-flower-text'>DELETE</span> /servers/<span class='emerald-text'>:serverId</span>/leave</span>
<span class='api-auth'>Requires authentication</span>

 - Response

204 on success, 400 on failure

### Delete a server

<span class='api-endpoint'><span class='sun-flower-text'>DELETE</span> /servers/<span class='emerald-text'>:serverId</span></span>
<span class='api-auth'>Requires authentication and <span class='sun-flower-text'>SERVER_OWNER</span> permission</span>

 - Response

204 on success

### Post a message

<span class='api-endpoint'><span class='sun-flower-text'>POST</span> /servers/<span class='emerald-text'>:serverId</span>/messages</span>
<span class='api-auth'>Requires authentication</span>

 - Request data

| Field   | Type   | Description                           |
|---------|--------|---------------------------------------|
| content | string | Content of the message (raw markdown) |

 - Response

204 on success, 400 on failure

### Edit a message

<span class='api-endpoint'><span class='sun-flower-text'>PUT/PATCH</span> /servers/<span class='emerald-text'>:serverId</span>/messages/<span class='emerald-text'>:messageId</span></span>
<span class='api-auth'>Requires authentication and must be the <span class='sun-flower-text'>author of the message</span></span>

 - Request data

| Field   | Type   | Description                           |
|---------|--------|---------------------------------------|
| content | string | Content of the message (raw markdown) |

 - Response

204 on success, 400 on failure

### Delete a message

<span class='api-endpoint'><span class='sun-flower-text'>DELETE</span> /servers/<span class='emerald-text'>:serverId</span>/messages/<span class='emerald-text'>:messageId</span></span>
<span class='api-auth'>Requires authentication and <span class='sun-flower-text'>SERVER_OWNER</span> permission, or to be the <span class='sun-flower-text'>author of the message</span></span>

 - Response

204 on success

## Invites

### Create an invite

<span class='api-endpoint'><span class='sun-flower-text'>POST</span> /servers/<span class='emerald-text'>:serverId</span>/invites</span>
<span class='api-auth'>Requires authentication and <span class='sun-flower-text'>SERVER_OWNER</span> permission</span>

 - Response

| Field | Type   | Description |
|-------|--------|-------------|
| code  | string | Invite code |

### Accept an invite

<span class='api-endpoint'><span class='sun-flower-text'>POST</span> /invites/<span class='emerald-text'>:invite</span></span>
<span class='api-auth'>Requires authentication</span>

 - Response

204 on success, 400 on failure
