import com.android.build.gradle.LibraryExtension

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Compatibility fix for older Flutter plugins that still omit AGP namespace.
subprojects {
    plugins.withId("com.android.library") {
        if (name == "blue_thermal_printer") {
            val androidExt = extensions.findByName("android")
            if (androidExt is LibraryExtension) {
                if (androidExt.namespace == null) {
                    androidExt.namespace = "id.kakzaki.blue_thermal_printer"
                }
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
