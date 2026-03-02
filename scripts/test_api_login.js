const axios = require('axios');

async function testLogin() {
    try {
        console.log('Testing login endpoint at http://localhost:5000/api/auth/login...');
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'superadmin@genlab.com',
            password: 'password123'
        });
        console.log('✅ Login Successful!');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Login Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testLogin();
