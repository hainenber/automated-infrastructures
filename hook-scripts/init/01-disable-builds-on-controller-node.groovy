import jenkins.model.Jenkins;

// Disable builds on controller node by setting executor number to 0.   
// This should be done after finish execution of seed job.
def controllerNode = Jenkins.get()
if (controllerNode) {
    controllerNode.setNumExecutors(0);
    controllerNode.save();
    println("[INIT] Disable builds on controller node by setting its executor to 0.")
} else {
    println("[INIT] Built-in node not found.")
}
