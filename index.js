const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron')
const fs = require('fs').promises;
const neighborhoods = require('./data/neighborhoods'); // Import data from the data directory
dotenv.config();

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Models
const User = require('./Models/User');
const Listing = require('./Models/Listing'); // Ensure this path is correct

const app = express();
const port = process.env.PORT || 3000;
// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'https://urban-frontend.onrender.com',
  credentials: true
}));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder where files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));  },
});

const upload = multer({ storage: storage });

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
const userRoutes = require('./routes/userRoutes');
app.use('/users', userRoutes);

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, async (err, userData) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });
      const user = await User.findById(userData.id);
      const { name, email, Number, _id } = user;
      res.json({ name, email, Number, _id });
    });
  } else {
    res.json(null);
  }
});

app.post('/profile/edit', async (req, res) => {
  const { token } = req.cookies;
  const { name, email } = req.body;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userData.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name || user.name;
    user.email = email || user.email;
    await user.save();

    res.json({ name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
});

cron.schedule('0 0 * * * *', async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    console.log('Date 30 days ago:', thirtyDaysAgo);

    const expiredListings = await Listing.find({
      createdAt: { $lt: thirtyDaysAgo },
      status: { $ne: 'expired' } 
    });

    console.log('Listings posted more than 30 days ago:', expiredListings);

    const updateResult = await Listing.updateMany(
      { createdAt: { $lt: thirtyDaysAgo }, status: { $ne: 'expired' } },
      { $set: { status: 'expired' } }
    );

    console.log('Update result:', updateResult);

  } catch (err) {
    console.error('Error fetching or updating listings:', err);
  }
});

app.post('/account/edit', async (req, res) => {
  const { token } = req.cookies;
  const { Number } = req.body;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userData.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (Number !== undefined) {
      user.Number = Number;
    }

    await user.save();

    res.json({ number: user.Number });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
});

// app.post('/security/edit', async (req, res) => {
//   const { token } = req.cookies;
//   const { oldPassword, newPassword, reenterNewPassword } = req.body;

//   if (!token) return res.status(401).json({ message: 'No token provided' });
//   if (newPassword !== reenterNewPassword) return res.status(400).json({ message: 'New passwords do not match' });

//   try {
//     const userData = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(userData.id);
//     if (!user) return res.status(404).json({ message: 'User not found' });
  

//     const isMatch = await bcrypt.compare(oldPassword, user.password);
//     if (!isMatch) 
//       return res.status(400).json({ message: 'Old password is incorrect' });

//     const hashedNewPassword = await bcrypt.hash(newPassword, 10);

//     user.password = hashedNewPassword;
//     await user.save();

//     res.json({ message: 'Password updated successfully' });
//   } catch (error) {
//     res.status(500).json({ message: 'An error occurred', error: error.message });
//   }
// });
app.put('/listings/:id', upload.array('Files[]'), async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    // Verify the JWT token
    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userData.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Extract listing ID from URL params
    const listingId = req.params.id;

    // Find the listing by ID
    const existingListing = await Listing.findById(listingId);
    if (!existingListing) return res.status(404).json({ message: 'Listing not found' });

    // Check if the user is the owner of the listing
    if (existingListing.UserId.toString() !== userData.id) {
      return res.status(403).json({ message: 'You are not authorized to update this listing' });
    }

    // Update fields
    const {
      rent_sale,
      AdOwner,
      PropType,
      Title,
      Price,
      Description,
      PropertySize,
      Bedrooms,
      Bathrooms,
      Furnished,
      Keywords,
      City,
      Neighborhood,
      Facilities,
    } = req.body;

    // Update listing fields
    existingListing.rent_sale = rent_sale;
    existingListing.AdOwner = AdOwner;
    existingListing.PropType = PropType;
    existingListing.Title = Title;
    existingListing.Price = Price;
    existingListing.Description = Description;
    existingListing.PropertySize = PropertySize;
    existingListing.Bedrooms = Bedrooms;
    existingListing.Bathrooms = Bathrooms;
    existingListing.Furnished = Furnished;
    existingListing.Keywords = Keywords;
    existingListing.City = City;
    existingListing.Neighborhood = Neighborhood;
    existingListing.Facilities = Facilities;

    // Handle deleted files
    if (req.body.deletedFiles) {
      const deletedFilesArray =req.body.deletedFiles; // Ensure it's an array
      existingListing.File = existingListing.File.filter(file => !deletedFilesArray.includes(file));

      const uploadDirectory = './uploads';
      await Promise.all(
        deletedFilesArray.map(async (fileName) => {
          const filePath = path.join(uploadDirectory, fileName);
          try {
            await fs.unlink(filePath);
            console.log(`File ${filePath} deleted successfully`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        })
      );
    }

    // Handle new file uploads
    if (req.files && req.files.length > 0) {
      const existingFiles = existingListing.File || [];
      existingListing.File = existingFiles.concat(req.files.map(file => file.filename));
    }

    await existingListing.save();
    res.status(200).json({ message: 'Listing updated successfully', listing: existingListing });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ message: 'An error occurred while updating the listing', error: error.message });
  }
});


app.post('/security/edit', async (req, res) => {
  const { token } = req.cookies;
  const { oldPassword, newPassword, reenterNewPassword } = req.body;

  if (!token) return res.status(401).json({ message: 'No token provided' });
  if (newPassword !== reenterNewPassword) return res.status(400).json({ message: 'New passwords do not match' });

  try {
    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userData.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Compare old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return res.status(400).json({ message: 'Old password is incorrect' });

    // Hash and save new password
    user.password = newPassword; // Assign new password
    await user.save(); // This triggers the pre-save hook

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
});

app.post('/listings', upload.array('Files[]'), async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userData.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const {
      rent_sale,
      AdOwner,
      PropType,
      Title,
      Price,
      Description,
      PropertySize,
      PropertyAge,
      Bedrooms,
      Bathrooms,
      Furnished,
      Keywords,
      City,
      Neighborhood,
      Facilities,
    } = req.body;
    console.log(req.files)
    const files = req.files ? req.files.map(file => file.filename) : [];
const UserId = userData.id;
    const newListing = new Listing({
      UserId,
      rent_sale,
      AdOwner,
      PropType,
      Title,
      Price,
      Description,
      PropertySize,
      PropertyAge,
      Bedrooms,
      Bathrooms,
      Furnished,
      Keywords,
      City,
      Neighborhood,
      Facilities,
      File: files, // Save filenames or paths
    });

    await newListing.save();
    res.status(201).json({ message: 'Listing created successfully', listing: newListing });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ message: 'An error occurred while creating the listing', error: error.message });
  }
});


app.get('/listings', async (req, res) => {
  try {
    const listings = await Listing.find({});
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching listings', error: error.message });
  }
});

app.get('/my-listings/:listingId', async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const userData = jwt.verify(token, process.env.JWT_SECRET);
    const userID = new mongoose.Types.ObjectId(userData.id);
    const { listingId } = req.params; // Extract listingId from route parameters

    // Query to find the listing by UserId and listingId
    const listing = await Listing.findOne({ UserId: userID, _id: listingId });

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.json(listing);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ message: 'Error fetching listing', error: error.message });
  }
});

app.get('/my-listings', async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const userData = jwt.verify(token, process.env.JWT_SECRET);

    const userID= new mongoose.Types.ObjectId(userData.id);

    const listings = await Listing.find({ UserId: userID });

    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: 'Error fetching listings', error: error.message });
  }
});


app.get('/images/:listingId', async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const listing = await Listing.findById(listingId).exec();

    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    res.json(listing.Files); // Return the filenames of the images
  } catch (error) {
    res.status(500).json({ message: 'Error fetching listing images', error: error.message });
  }
});
app.get('/filtered_listings', async (req, res) => {
  try {

    const { minPrice, maxPrice, bedrooms, propertyType, amenities, city, rent_sale, bathrooms, furnished ,neighborhood} = req.query;
    const filter = {};
    console.log(req.query,"fdfd")

    if (minPrice) {
      filter.Price = { $gte: parseFloat(minPrice) };
    }
    if (maxPrice) {
      filter.Price = { ...filter.Price, $lte: parseFloat(maxPrice) };
    }

    // Bedrooms filter (exact match)
    if (bedrooms) {
      const bedroomsInt = parseInt(bedrooms, 10);
      if (!isNaN(bedroomsInt)) {
        filter.Bedrooms = bedroomsInt;
      }
    }
    if(neighborhood){
      filter.Neighborhood = neighborhood;
    }
    

    // Property Type filter
    if (propertyType) {
      filter.PropType = propertyType;
    }

    // Amenities filter (handling array)
    if (amenities) {
      // Assuming amenities are passed as a comma-separated list
      const amenitiesArray = amenities.split(',').map(item => item.trim());
      if (amenitiesArray.length > 0) {
        filter.Facilities = { $all: amenitiesArray };
      }
    }

    // City filter
    if (city) {
      filter.City = city;
    }

    // Rent/Sale filter
    if (rent_sale) {
      filter.rent_sale = rent_sale;
    }
    if (bathrooms) {

      const bathroomsInt = parseInt(bathrooms, 10);
      if (!isNaN(bathroomsInt)) {
        filter.Bathrooms = bathroomsInt

      }
    }

    // Furnished filter
    if (furnished) {
      filter.Furnished = furnished === 'true' ? true : furnished === 'false' ? false : furnished;
    }
    console.log(filter)
    // Query the database with the filter
    const listings = await Listing.find(filter);

    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: 'An error occurred while fetching the listings', error: error.message });
  }
});


app.get('/search', (req, res) => {
  const cityQuery = req.query.c?.toLowerCase();
  const searchQuery = req.query.q?.toLowerCase(); 


  let filteredResults = neighborhoods;

  if (cityQuery) {
    filteredResults = neighborhoods.filter((neighborhood) =>
      neighborhood.city.toLowerCase() === cityQuery
    );
  }
  if (searchQuery) {
    filteredResults = filteredResults.filter((neighborhood) =>
      neighborhood.name.toLowerCase().includes(searchQuery) ||
      neighborhood.area.toLowerCase().includes(searchQuery) 
    );
  }

  res.json(filteredResults); // Send the filtered results back to the client
});
app.get('/neighborhood', async (req, res) => {
  try {
    const { city } = req.query;  
    let filteredCities = neighborhoods;

    if (city) {
      filteredCities = neighborhoods.filter(
        (neighbor) => neighbor.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    res.json(filteredCities); 

  } catch (error) {
    console.error('Error fetching neighborhoods:', error);
    res.status(500).json({ message: 'An error occurred while fetching the neighborhoods', error: error.message });
  }
});


app.get('/ad/:ad_id', async (req, res) => {
  try {
    const ad_id = req.params.ad_id;
    const adid = new mongoose.Types.ObjectId(ad_id);
    const ad = await Listing.findOne({ _id: adid });
    if (!ad) {
      return res.status(404).json({ message: 'Advertisement not found' });
    }
    res.json(ad);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.delete('/ad/delete/:adId', async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const userData = jwt.verify(token, process.env.JWT_SECRET);

    const adId = req.params.adId;
    const adid = new mongoose.Types.ObjectId(adId);
    const ad = await Listing.findOne({ _id: adid, UserId: userData.id });

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    // Assuming the images are stored in the 'uploads' directory
    const uploadDirectory = './uploads'; // Directory where files are stored

    // If the ad contains files, delete them from the file system
    if (ad.File && ad.File.length > 0) {
      await Promise.all(
        ad.File.map(async (fileName) => {
          const filePath = path.join(uploadDirectory, fileName); // Construct full path
          try {
            await fs.unlink(filePath); // Delete file from the file system
            console.log(`File ${filePath} deleted successfully`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        })
      );
    }

    // After deleting the files, remove the ad from the database
    await Listing.deleteOne({ _id: adid });

    res.status(200).json({ message: 'Ad and associated files deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});







app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
