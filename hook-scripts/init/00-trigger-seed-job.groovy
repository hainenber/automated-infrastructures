import jenkins.model.Jenkins
import hudson.model.Cause
import hudson.model.Result

import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval
import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval.PendingScript

// List out scripts for approval
// Only approve hash of jobs declared in ./data/jobs
// This is to allow seed job to run normally. 

class SeedJob {
    static void approvePendingScriptsInSeedJob() {
        def approvedHashes = [
            // build_jenkins_plugin_manager_jar.groovy
            'SHA512:1f5ae642ddb6a8f130d865fafd6ee2eea350b76ff36212ed551a2eea7c39e2c7c899954f4bc18dc624b713214b46ddee7c5fab1a235f5430ec3c9f1200cd6640',
            // build_jenkins_war.groovy
            'SHA512:79aae170f1b91185050bdaa30d512d2a8416d70224a2062f510ce6f817eea249563de00bee62c4bae15af0dca25f68e708abe4efdbe6fd0b438a5b91aac59ab8',
        ]
        def scriptApproval = ScriptApproval.get()
        scriptApproval.getPendingScripts().clone().each { pendingScript ->
            String scriptHash = pendingScript.getHash()
            if (approvedHashes.contains(scriptHash)) {
                scriptApproval.approveScript(scriptHash)
            }
        }
    }

    static int runSeedJob(count) {
        def job = Jenkins.get().getItemByFullName('seed')
        if (job == null) {
            throw new RuntimeException("[INIT][ERROR] Seed job not found. Exiting script")
        }

        def cause = new Cause.RemoteCause("script", "Triggered by 00-trigger-seed-job.groovy")
        def future = job.scheduleBuild2(0, cause)

        if (future != null) {
            println("[INIT][INFO] Seed job triggered successfully. Waiting for the job to finish...")

            // Wait until the build is complete.
            // Blocks the script until the build is finished.
            def build = future.get() 

            // Check the result of the build.
            def result = build.getResult()

            if (result == Result.SUCCESS) {
                println("[INIT][INFO] Seed job completed successfully.")
            } else {
                if (count == 1) {
                    println("[INIT][WARN] Seed job did not complete successfully. Possibly due to unapproved Job DSL scripts.")
                    return 0
                } else {
                    throw new RuntimeException("[INIT][ERROR] Seed job did not complete successfully. Status: ${result.toString()}")
                }

            }
        } else {
            throw new RuntimeException("[INIT][ERROR] Failed to trigger seed job.")
        }

        return 1
    }
}

// Temporarily allow controller node to execute seed job.
// Controller node will be disabled for builds in 01-disable-builds-on-controller-node.groovy  
def controllerNode = Jenkins.get()
controllerNode.setNumExecutors(1);
controllerNode.save();

// Trigger
def firstSeedJobRun = SeedJob.runSeedJob(1)
if (firstSeedJobRun != 1) {
    SeedJob.approvePendingScriptsInSeedJob()
    println("[INIT][INFO] Rerunning seed job after finish approving Job DSL scripts.")
    SeedJob.runSeedJob(2)
}