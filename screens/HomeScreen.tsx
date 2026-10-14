import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Shadow } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

interface Job {
  customer_name: string;
  job_id: number;
  jobs_notes: string;
  bin_name: string;
  job_type_name: string;
  company_name: string;
  priority: string;
}

const HomeScreen = () => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const navigation = useNavigation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchJobs = async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setAutoRefreshing(true);
      }
      const response = await makeAuthenticatedRequest(`/jobs`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs);
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to fetch jobs');
    } finally {
      if (isAutoRefresh) {
        setAutoRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchJobs(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [user, makeAuthenticatedRequest]);

  const getPriorityInfo = (priority: string) => {
    const p = parseInt(priority, 10);
    if (p >= 8) return { color: Colors.error, bg: '#fee2e2', icon: 'flash' };
    if (p >= 5) return { color: Colors.accent, bg: '#fff7ed', icon: 'time' };
    return { color: Colors.secondary, bg: '#ecfdf5', icon: 'checkmark-circle' };
  };

  const renderJob = ({ item }: { item: Job }) => {
    const priority = getPriorityInfo(item.priority);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => (navigation as any).navigate('JobDetail', { jobId: item.job_id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Ionicons name={priority.icon as any} size={14} color={priority.color} />
            <Text style={[styles.priorityText, { color: priority.color }]}>
              Priority {item.priority}
            </Text>
          </View>
          <Text style={styles.jobId}>#{item.job_id}</Text>
        </View>

        <View style={styles.cardBody}>

          {item.jobs_notes && (
            <Text style={styles.jobNotes} >
              {item.jobs_notes}
            </Text>
          )}
          <Text style={styles.companyName}>Customer: {item.customer_name || 'No Customer'}</Text>
          <Text style={styles.companyName}>COMPANY: {item.company_name || 'No Company'}</Text>
          <Text style={styles.jobType}>JOB TYPE: {item.job_type_name}</Text>
          
       

          <View style={styles.cardFooter}>
            <View style={styles.binInfo}>
              <Ionicons name="cube-outline" size={16} color={Colors.textLight} />
              <Text style={styles.binText}>{item.bin_name || '—'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.first_name || 'User'}</Text>
          <Text style={styles.title}>Today's Work</Text>
        </View>
        {autoRefreshing && (
          <ActivityIndicator size="small" color={Colors.primary} />
        )}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.job_id.toString()}
        renderItem={renderJob}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color={Colors.border} />
            <Text style={styles.emptyText}>All clear for today!</Text>
            <Text style={styles.emptySubtext}>No jobs currently assigned.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textLight,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textLight,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#fafafa',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  jobId: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  cardBody: {
    padding: Spacing.md,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  jobType: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  jobNotes: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  binInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  binText: {
    fontSize: 14,
    color: Colors.textLight,
    marginLeft: 6,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
});

export default HomeScreen;