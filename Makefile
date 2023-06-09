# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

SHELL := /bin/bash -o pipefail

VERSION ?= latest
RELEASE_SRC = skywalking-grafana-plugins-${VERSION}-src
RELEASE_DIST = apache-skywalking-datasource-${VERSION}

GPG_UID :=

# set gpg user id
ifdef GPG_UID
	GPG_UID_FLAG := -u $(GPG_UID)
endif

.PHONY: release-src
release-src:
	tar -zcvf $(RELEASE_SRC).tgz \
	--exclude .git/ \
	--exclude .idea/ \
	--exclude .gitignore \
	--exclude .DS_Store \
	--exclude .github \
	--exclude lib \
	--exclude node_modules \
	--exclude release \
	--exclude $(RELEASE_SRC).tgz \
	.

	gpg $(GPG_UID_FLAG) --batch --yes --armor --detach-sig $(RELEASE_SRC).tgz
	shasum -a 512 $(RELEASE_SRC).tgz > $(RELEASE_SRC).tgz.sha512

	mkdir -p release
	mv $(RELEASE_SRC).tgz release/$(RELEASE_SRC).tgz
	mv $(RELEASE_SRC).tgz.asc release/$(RELEASE_SRC).tgz.asc
	mv $(RELEASE_SRC).tgz.sha512 release/$(RELEASE_SRC).tgz.sha512

.PHONY: release-dist
release-dist:
	mv dist/ apache-skywalking-datasource
	zip $(RELEASE_DIST).zip apache-skywalking-datasource -r
	rm -rf apache-skywalking-datasource

	gpg $(GPG_UID_FLAG) --batch --yes --armor --detach-sig $(RELEASE_DIST).zip
	shasum -a 1 $(RELEASE_DIST).zip > $(RELEASE_DIST).zip.sha1

	mkdir -p release-dist
	mv $(RELEASE_DIST).zip release-dist/$(RELEASE_DIST).zip
	mv $(RELEASE_DIST).zip.asc release-dist/$(RELEASE_DIST).zip.asc
	mv $(RELEASE_DIST).zip.sha1 release-dist/$(RELEASE_DIST).zip.sha1

.PHONY: install
install:
	yarn install

.PHONY: clean
clean:
	rm -rf ./node_modules && \
	rm -rf ./lib

.PHONY: build
build:
	yarn build
