import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ListingType } from '@/lib/database.types';

const AMENITIES = [
  'Furnished',
  'In-unit Laundry',
  'Parking',
  'Utilities Included',
  'Pet Friendly',
  'Air Conditioning',
  'Dishwasher',
  'Gym Access',
];

// Compress image to reduce storage usage
const compressImage = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Resize to max 1200px width, maintaining aspect ratio
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri; // Return original if compression fails
  }
};

export default function CreateListingScreen() {
  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState<ListingType | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [address, setAddress] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { user, profile } = useAuth();
  const router = useRouter();

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8 - images.length,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...newImages].slice(0, 8));
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const uri of images) {
      try {
        // Compress image before uploading
        const compressedUri = await compressImage(uri);
        const fileName = `${user?.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

        // Read file as base64 and convert to ArrayBuffer
        const base64 = await FileSystem.readAsStringAsync(compressedUri, {
          encoding: 'base64',
        });
        const arrayBuffer = decode(base64);

        const { error: uploadError } = await supabase.storage
          .from('listings')
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('listings').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!listingType || !title || !price || !profile?.university_id) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Require contact phone for rental listings
    if (listingType === 'rental' && !contactPhone.trim()) {
      Alert.alert('Error', 'Please provide a contact phone number for rental listings');
      return;
    }

    setIsLoading(true);

    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await uploadImages();
      }

      const { error } = await supabase.from('listings').insert({
        user_id: user?.id,
        university_id: profile.university_id,
        title,
        description,
        listing_type: listingType,
        price: parseInt(price),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
        address,
        available_from: availableFrom || null,
        available_to: availableTo || null,
        amenities: selectedAmenities,
        images: imageUrls,
        contact_name: listingType === 'rental' ? (contactName.trim() || null) : null,
        contact_phone: listingType === 'rental' ? (contactPhone.trim() || null) : null,
        contact_email: listingType === 'rental' ? (contactEmail.trim() || null) : null,
      });

      if (error) throw error;

      Alert.alert('Success', 'Your listing has been posted!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error) {
      console.error('Error creating listing:', error);
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What type of listing?</Text>

      <Pressable
        style={[
          styles.typeCard,
          listingType === 'sublet' && styles.typeCardActive,
        ]}
        onPress={() => setListingType('sublet')}
      >
        <FontAwesome name="home" size={32} color={listingType === 'sublet' ? '#4A90E2' : '#666'} />
        <Text style={[styles.typeTitle, listingType === 'sublet' && styles.typeTitleActive]}>
          Sublet
        </Text>
        <Text style={styles.typeDescription}>
          You have a lease and need someone to take it over temporarily
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.typeCard,
          listingType === 'rental' && styles.typeCardActive,
        ]}
        onPress={() => setListingType('rental')}
      >
        <FontAwesome name="key" size={32} color={listingType === 'rental' ? '#4A90E2' : '#666'} />
        <Text style={[styles.typeTitle, listingType === 'rental' && styles.typeTitleActive]}>
          Rental
        </Text>
        <Text style={styles.typeDescription}>
          You're listing a property available for rent
        </Text>
      </Pressable>

      <Pressable
        style={[styles.singleButton, !listingType && styles.nextButtonDisabled]}
        onPress={() => listingType && setStep(2)}
        disabled={!listingType}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        Add photos{listingType === 'rental' ? ' (optional)' : ''}
      </Text>
      <Text style={styles.stepSubtitle}>
        {listingType === 'rental'
          ? 'Photos are optional for rental listings'
          : 'Add up to 8 photos of your place'}
      </Text>

      <View style={styles.imagesGrid}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri }} style={styles.imagePreview} />
            <Pressable style={styles.removeImage} onPress={() => removeImage(index)}>
              <FontAwesome name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {images.length < 8 && (
          <Pressable style={styles.addImageButton} onPress={pickImages}>
            <FontAwesome name="plus" size={24} color="#999" />
            <Text style={styles.addImageText}>Add Photo</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.hint}>First photo will be your cover image</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable style={styles.nextButton} onPress={() => setStep(3)}>
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Listing details</Text>

      <Text style={styles.inputLabel}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Summer sublet near campus"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.inputLabel}>Monthly Rent ($)</Text>
      <TextInput
        style={styles.input}
        placeholder="1200"
        placeholderTextColor="#999"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.inputLabel}>Bedrooms</Text>
          <TextInput
            style={styles.input}
            value={bedrooms}
            onChangeText={setBedrooms}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.inputLabel}>Bathrooms</Text>
          <TextInput
            style={styles.input}
            value={bathrooms}
            onChangeText={setBathrooms}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Location</Text>
      <TextInput
        style={styles.input}
        placeholder="123 College Ave"
        placeholderTextColor="#999"
        value={address}
        onChangeText={setAddress}
      />

      {listingType === 'rental' && (
        <>
          <Text style={styles.sectionHeader}>Landlord Contact Info</Text>

          <Text style={styles.inputLabel}>Contact Name (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Property manager name"
            placeholderTextColor="#999"
            value={contactName}
            onChangeText={setContactName}
          />

          <Text style={styles.inputLabel}>Contact Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            placeholderTextColor="#999"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>Contact Email (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="landlord@email.com"
            placeholderTextColor="#999"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </>
      )}

      {listingType === 'sublet' && (
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.inputLabel}>Available From</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#999"
              value={availableFrom}
              onChangeText={setAvailableFrom}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.inputLabel}>Available To</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#999"
              value={availableTo}
              onChangeText={setAvailableTo}
            />
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <Pressable style={styles.backButton} onPress={() => setStep(2)}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.nextButton, (!title || !price) && styles.nextButtonDisabled]}
          onPress={() => setStep(4)}
          disabled={!title || !price}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>More details</Text>

      <Text style={styles.inputLabel}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Tell potential renters about your place..."
        placeholderTextColor="#999"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.inputLabel}>Amenities</Text>
      <View style={styles.amenitiesGrid}>
        {AMENITIES.map((amenity) => (
          <Pressable
            key={amenity}
            style={[
              styles.amenityChip,
              selectedAmenities.includes(amenity) && styles.amenityChipActive,
            ]}
            onPress={() => toggleAmenity(amenity)}
          >
            <FontAwesome
              name={selectedAmenities.includes(amenity) ? 'check-square' : 'square-o'}
              size={16}
              color={selectedAmenities.includes(amenity) ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.amenityText,
                selectedAmenities.includes(amenity) && styles.amenityTextActive,
              ]}
            >
              {amenity}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={styles.backButton} onPress={() => setStep(3)}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Post Listing</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress indicator */}
        <View style={styles.progress}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[styles.progressDot, s <= step && styles.progressDotActive]}
            />
          ))}
        </View>
        <Text style={styles.progressText}>Step {step} of 4</Text>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: '#4A90E2',
  },
  progressText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  typeCard: {
    padding: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardActive: {
    borderColor: '#4A90E2',
    backgroundColor: '#E3F2FD',
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  typeTitleActive: {
    color: '#4A90E2',
  },
  typeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD',
  },
  addImageText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  amenityChipActive: {
    backgroundColor: '#E3F2FD',
  },
  amenityText: {
    fontSize: 14,
    color: '#666',
  },
  amenityTextActive: {
    color: '#4A90E2',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  singleButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    marginTop: 24,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: '#B0D4F1',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#50C878',
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
