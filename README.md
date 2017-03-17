## My Private Registry

A locally stored Docker registry that doesn't make you want to
pull out your hair.

### Why?

_**Doesn't the official registry already work just fine?**_ In theory, yes.
But it has issues. The docker registry in it's current form has a two
priority use cases:

* Never remove anything
* Store images in the cloud

However, there are those of us who do not have that luxury. Whether it's
regulatory or bandwidth, it's very possible that you need to store your
docker images on a server somewhere in the office. If that's the case,
then you'll find the official registry somewhat lacking. Deletion and
garbage collection were introduced WAY late, and even then, there are
serious bugs in the FS driver that haven't been resolved for months.

Because docker is SO important to my current employer and because I spent
so much time fighting with being able to clean up the docker registry, I
deicded to write my own instead.

### Features

* Fast
* Easy to understand storage model
* Manifest v2 Compliant (should work with v1, but not tested)
* Built-in web app to get manifest details
* Manifest deletion and garbage collection that really work
* Supports HTTPS for direct serving, or HTTP if behind a proxy
* Tested in a production environment
* Distributed in convenient docker container
* Example cleanup script (also in production)

### Tradeoffs

* Only works on the local filesystem
* No authentication
* Still has a few [issues](https://github.com/tedkulp/my-private-registry/issues)

### Usage

#### Running

To start it up:

    docker run -d -p 80:3000 --restart=always --name registry tedkulp/my-private-registry
    
If you're storing your data in a directory on your server somewhere:

    docker run -d -p 80:3000 -v /path/to/data:/code/data --restart=always --name registry tedkulp/my-private-registry
    
#### Environment Variables

<dl>
  <dt>REGISTRY_USE_HTTP</dt>
  <dd>Set this to true if you want to serve http behind a proxy</dd>

  <dt>REGISTRY_PORT</dt>
  <dd>Use this if you need to change the port from 3000 for some reason. It shouldn't really be necessary in a docker container, though.</dd>
</dl>

More to come, especially for cert details

#### Garbage Collection

To clean up any blobs that aren't being referenced, run this command. If you're deleting stuff
regulary, put it in a cron job.

    docker exec -it registry index.js gc -d /code/data

### Contributing

Please! Create some issues of stuff I'm missing. Submit a merge request if you can fix it. I'm open to any collaboration.
