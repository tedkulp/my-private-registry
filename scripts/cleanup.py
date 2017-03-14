#!/usr/bin/env python3

# Test cleanup script. Change REGISTRY_URL to match.
# It will remove all manifests older than 30 days.
# Modify to suit taste.
#
# Make sure to run 'index.js gc' after this to remove
# blobs from the registry

from requests import get, delete
import sys
import re
import json
from datetime import datetime, timedelta
from os import listdir,remove,rmdir,path
from shutil import rmtree

REGISTRY_URL = "http://127.0.0.1:3000/v2/"
HOW_OLD = timedelta(days=30)

def get_json(path):
    return get(REGISTRY_URL+path).json()

def list_repos():
    return get_json("_catalog")["repositories"]

def list_tags(repo):
    return get_json("%s/tags/list" % repo)["tags"]

def get_manifest(repo, tag):
    return get_json("%s/manifests/%s" % (repo, tag))

def get_blob(repo, digest):
    return get_json("%s/blobs/%s" % (repo, digest))

def get_layers(image, tag):
    layers = []
    fslayers = get_json("%s/manifests/%s" % (image, tag))["fsLayers"]
    for item in fslayers:
        layers.append(item["blobSum"])
    return layers

def add_if_unique(list, item):
    if not item in list:
        list.append(item)

def delete_tag(repo, tag):
    r = get(REGISTRY_URL + repo + '/manifests/' + tag, headers={'Accept': 'application/vnd.docker.distribution.manifest.v2+json'})
    if 'docker-content-digest' in r.headers:
        return delete(REGISTRY_URL + repo + '/manifests/' + r.headers['docker-content-digest'])

if __name__ == "__main__":
    tags_to_delete = []

    a_while_ago = datetime.now() - HOW_OLD

    repos = list_repos()
    for repo in repos:
        tags = list_tags(repo)
        for tag in tags:
            manifest = get_manifest(repo, tag)
            date_string = ''
            if manifest["schemaVersion"] == 2:
                blob = get_blob(repo, manifest["config"]["digest"])
                date_string = blob["created"][:19]
            else:
                # If v1, should be able to directly get created date,
                # but I didn't have any to test
                print("v1?", repo, tag)

            if date_string != '':
                date = datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S')

                if a_while_ago > date:
                    add_if_unique(tags_to_delete, repo + ":" + tag)

    print(tags_to_delete)

    for tag_to_delete in tags_to_delete:
        repo, tag = tag_to_delete.split(':', 1)

        print("Deleting:", repo, tag)

        r = delete_tag(repo, tag)
        print(r, r.status_code, r.headers, r.text)

# vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
