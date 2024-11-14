# Automated Infrastructure

An attempt to create a infrastructure setup by Infrastructure-as-Code approach.

## Project status

ACTIVE

## Prerequisites

- Node.js v22+ to run init scripts.
- Java17+ installation to run Jenkins.
- [`multipass`](https://multipass.run/) for creating Jenkins agents.
- [`jq`](https://jqlang.github.io/jq/).

## Usage

### Jenkins

Run `npm run start-jenkins` for the very first time!

If you add new Jenkins job definition in `./jobs`, Jenkins will fail to run its seed job as the newly Jenkins job definition
is not yet approved. You'll need to login to Jenkins, manually approve the job definition and rerun the startup script.

### Sonatype Nexus

Run `npm run start-nexus` to setup repository/artifact management Sonatype Nexus

## SBOMs

- [Node.js, a JavaScript runtime](https://nodejs.org)
- [Java](https://www.oracle.com/java/)
- [Multipass](https://multipass.run/)
- [`jq`](https://jqlang.github.io/jq/)
- [UpdateCLI](https://github.com/updatecli/updatecli?tab=readme-ov-file)
- [sdkman](https://sdkman.io/)
