# Jenkins Lab

A laboratory to explore Jenkins and realize it to the fullest.

## Project status

ACTIVE

## Usage

NOTE: make sure you have Java 17+ installation on your local machine.

Run `./start-jenkins.sh` for the very first time!

If you add new Jenkins job definition in `./jobs`, Jenkins will fail to run its seed job as the newly Jenkins job definition
is not yet approved. You'll need to login to Jenkins, manually approve the job definition and rerun the startup script.
