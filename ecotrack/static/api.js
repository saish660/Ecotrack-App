function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// API Service Class
class EcoTrackAPI {
    async getDashboardData() {
        let userdata;

        await fetch("get_user_data", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: {}
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok (${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                userdata = data
                console.log(userdata['data']['achievements'])
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while submitting the form. Please try again.');
            });
        return {
            sustainability_score: userdata['data']['sustainability_score'],
            carbon_footprint: userdata['data']['carbon_footprint'],
            habits_completed_today: userdata['data']['habits_today'],
            streak_count: userdata['data']['streak'],
            habits: userdata['data']['habits'],
            achievements: userdata['data']['achievements'],
            last_8_footprints: userdata['data']['last_8_footprints'],
        };
    }

}
