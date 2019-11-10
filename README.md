# Drone Status

Add a Drone status in your status bar.

![preview](/preview.gif)

# Usage

- Add `.drone.status` file in the root of your project.
  
    ```JSON
    {
        "url": "https://${droneHost}/${namespace}/${repo}/"
    }
    ```
- Fill `drone.accessToken`, you can retrieve your user token from your user profile screen (`/account/token`) in the Drone user interface.

**The token needs to be added in the settings.json file (.vscode folder) like this:**

```JSON
{
    "drone": {
        "accessToken": "<YOUR TOKEN>"
    }
}
```
