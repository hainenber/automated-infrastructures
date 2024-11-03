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
            'SHA512:fea3f17ae00259d0e9fbe1cc6fc65e16a507a11ed2970744f627b9099ccde2ca7c8aca772d4ebec2961e9f637a03bd50957cbeaa0b746f96a97aa64f508b7bae',
            // build_jenkins_war.groovy
            'SHA512:49410e05c64660d65a1687abaa8aa15fe8457658fef96ee832fb75e9e472c658c3a6a42183aab43f22dbdbbfaac57794ae3968a7bbc96de3a251db0f9c952777'
        ]
        def scriptApproval = ScriptApproval.get()
        scriptApproval.getPendingScripts().each { pendingScript ->
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