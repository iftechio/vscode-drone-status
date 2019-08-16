# Drone Status

Add a Drone status in your status bar.

![preview](/preview.gif)

# usage

- Add `.drone.status` file in the root of your project.
  
    ```JSON
    {
        "url": "https://cloud.drone.io/${namespace}/${repo}/"
    }
    ```
- Fill `drone.accessToken`, you can retrieve your user token from your user profile screen (`/account/token`) in the Drone user interface.
