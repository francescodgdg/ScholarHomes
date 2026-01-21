import { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ListingType, ListingStatus } from '@/lib/database.types';

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

const compressImage = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri;
  }
};

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [listingUserId, setListingUserId] = useState<string | null>(null);

  // Form fields
  const [listingType, setListingType] = useState<ListingType>('rental');
  const [status, setStatus] = useState<ListingStatus>('active');
  const [images, setImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
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

  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const hasUnsavedChanges = () => {
    if (!originalData) return false;
    return (
      listingType !== originalData.listing_type ||
      status !== originalData.status ||
      title !== originalData.title ||
      price !== originalData.price.toString() ||
      bedrooms !== originalData.bedrooms.toString() ||
      bathrooms !== originalData.bathrooms.toString() ||
      address !== (originalData.address || '') ||
      description !== (originalData.description || '') ||
      JSON.stringify(selectedAmenities) !== JSON.stringify(originalData.amenities || []) ||
      JSON.stringify(images) !== JSON.stringify(originalData.images || []) ||
      newImages.length > 0 ||
      contactName !== (originalData.contact_name || '') ||
      contactPhone !== (originalData.contact_phone || '') ||
      contactEmail !== (originalData.contact_email || '')
    );
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const fetchListing = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Listing not found');
      router.back();
      return;
    }

    // Check permission
    const isOwner = data.user_id === user?.id;
    const isAdmin = profile?.role === 'admin';

    if (!isOwner && !isAdmin) {
      Alert.alert('Error', 'You do not have permission to edit this listing');
      router.back();
      return;
    }

    setListingUserId(data.user_id);
    setListingType(data.listing_type);
    setStatus(data.status);
    setImages(data.images || []);
    setTitle(data.title);
    setPrice(data.price.toString());
    setBedrooms(data.bedrooms.toString());
    setBathrooms(data.bathrooms.toString());
    setAddress(data.address || '');
    setAvailableFrom(data.available_from || '');
    setAvailableTo(data.available_to || '');
    setDescription(data.description || '');
    setSelectedAmenities(data.amenities || []);
    setContactName(data.contact_name || '');
    setContactPhone(data.contact_phone || '');
    setContactEmail(data.contact_email || '');

    // Store original data for change detection
    setOriginalData(data);

    setIsLoading(false);
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8 - images.length - newImages.length,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setNewImages([...newImages, ...uris].slice(0, 8 - images.length));
    }
  };

  const removeExistingImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const uploadNewImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const uri of newImages) {
      try {
        const compressedUri = await compressImage(uri);
        const fileName = `${user?.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

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

  const handleSave = async () => {
    if (!title || !price) {
      Alert.alert('Error', 'Please fill in title and price');
      return;
    }

    if (listingType === 'rental' && !contactPhone.trim()) {
      Alert.alert('Error', 'Please provide a contact phone number for rental listings');
      return;
    }

    setIsSaving(true);

    try {
      let allImages = [...images];
      if (newImages.length > 0) {
        const uploadedUrls = await uploadNewImages();
        allImages = [...allImages, ...uploadedUrls];
      }

      const { error } = await supabase
        .from('listings')
        .update({
          listing_type: listingType,
          status,
          title,
          description,
          price: parseInt(price),
          bedrooms: parseInt(bedrooms),
          bathrooms: parseInt(bathrooms),
          address,
          available_from: availableFrom || null,
          available_to: availableTo || null,
          amenities: selectedAmenities,
          images: allImages,
          contact_name: listingType === 'rental' ? (contactName.trim() || null) : null,
          contact_phone: listingType === 'rental' ? (contactPhone.trim() || null) : null,
          contact_email: listingType === 'rental' ? (contactEmail.trim() || null) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'Listing updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error updating listing:', error);
      Alert.alert('Error', 'Failed to update listing. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { error } = await supabase
                .from('listings')
                .delete()
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Deleted', 'Your listing has been deleted.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') },
              ]);
            } catch (error) {
              console.error('Error deleting listing:', error);
              Alert.alert('Error', 'Failed to delete listing. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Edit Listing',
          headerLeft: () => (
            <Pressable onPress={handleCancel} style={{ padding: 8 }}>
              <FontAwesome name="times" size={22} color="#666" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status (Admin only) */}
          {profile?.role === 'admin' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status</Text>
              <View style={styles.statusOptions}>
                {(['active', 'paused', 'rented'] as const).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.statusOption, status === s && styles.statusOptionActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.statusOptionText, status === s && styles.statusOptionTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Listing Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Listing Type</Text>
            <View style={styles.typeOptions}>
              <Pressable
                style={[styles.typeOption, listingType === 'sublet' && styles.typeOptionActive]}
                onPress={() => setListingType('sublet')}
              >
                <FontAwesome name="home" size={20} color={listingType === 'sublet' ? '#4A90E2' : '#666'} />
                <Text style={[styles.typeOptionText, listingType === 'sublet' && styles.typeOptionTextActive]}>
                  Sublet
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeOption, listingType === 'rental' && styles.typeOptionActive]}
                onPress={() => setListingType('rental')}
              >
                <FontAwesome name="key" size={20} color={listingType === 'rental' ? '#4A90E2' : '#666'} />
                <Text style={[styles.typeOptionText, listingType === 'rental' && styles.typeOptionTextActive]}>
                  Rental
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Images */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos {listingType === 'rental' ? '(optional)' : ''}
            </Text>
            <View style={styles.imagesGrid}>
              {images.map((uri, index) => (
                <View key={`existing-${index}`} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable style={styles.removeImage} onPress={() => removeExistingImage(index)}>
                    <FontAwesome name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {newImages.map((uri, index) => (
                <View key={`new-${index}`} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable style={styles.removeImage} onPress={() => removeNewImage(index)}>
                    <FontAwesome name="close" size={14} color="#fff" />
                  </Pressable>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                </View>
              ))}
              {images.length + newImages.length < 8 && (
                <Pressable style={styles.addImageButton} onPress={pickImages}>
                  <FontAwesome name="plus" size={24} color="#999" />
                  <Text style={styles.addImageText}>Add</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Listing title"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Monthly Rent ($) *</Text>
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
          </View>

          {/* Contact Info (Rentals only) */}
          {listingType === 'rental' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Landlord Contact Info</Text>

              <Text style={styles.inputLabel}>Contact Name</Text>
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

              <Text style={styles.inputLabel}>Contact Email</Text>
              <TextInput
                style={styles.input}
                placeholder="landlord@email.com"
                placeholderTextColor="#999"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Dates (Sublets only) */}
          {listingType === 'sublet' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
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
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
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
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
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
          </View>

          {/* Save Button */}
          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>

          {/* Delete Button */}
          <Pressable
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color="#E74C3C" />
            ) : (
              <>
                <FontAwesome name="trash" size={18} color="#E74C3C" />
                <Text style={styles.deleteButtonText}>Delete Listing</Text>
              </>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  statusOptionActive: {
    backgroundColor: '#4A90E2',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusOptionTextActive: {
    color: '#fff',
  },
  typeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    borderColor: '#4A90E2',
    backgroundColor: '#E3F2FD',
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#4A90E2',
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
  newBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#50C878',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
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
  saveButton: {
    backgroundColor: '#50C878',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 18,
    fontWeight: '600',
  },
});
